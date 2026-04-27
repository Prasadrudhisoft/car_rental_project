import qrcode
import io
from django.core.files.base import ContentFile
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.locations.models import Location
 
from .models import Vehicle, VehicleDocument, VehiclePhoto, VehicleAvailability
from .serializers import (
    VehicleListSerializer, VehicleDetailSerializer, VehicleCreateSerializer,
    VehicleDocumentSerializer, VehiclePhotoSerializer, VehicleAvailabilitySerializer,
)
 
 
# ── Role permission helpers ─────────────────────────────────────────────
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'admin'
 
class IsVendorRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'vendor'
 
 
# ── QR code generator ─────────────────────────────────────────────────────
def _generate_qr(vehicle):
    """
    Creates a QR code image for the vehicle and saves it to vehicle.qr_code_image.
    The QR encodes the public vehicle profile URL so customers can scan it.
    """
    url = f"https://carrentindia.com/vehicles/{vehicle.id}/"
    img = qrcode.make(url)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    filename = f"vehicle_{vehicle.vehicle_id_code}.png"
    vehicle.qr_code_image.save(filename, ContentFile(buffer.getvalue()), save=False)
 
 
# ════════════════════════════════════════════════════════════════════════
# VENDOR VIEWS
# ════════════════════════════════════════════════════════════════════════
 
class VendorVehicleViewSet(viewsets.ModelViewSet):
    """
    CRUD for a vendor's own vehicles.
    GET  /api/vehicles/vendor/             -> list my vehicles
    POST /api/vehicles/vendor/             -> create a new listing
    GET  /api/vehicles/vendor/{id}/        -> single vehicle detail
    PATCH /api/vehicles/vendor/{id}/       -> edit vehicle info
    POST /api/vehicles/vendor/{id}/toggle/ -> activate or deactivate listing
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return VehicleCreateSerializer
        return VehicleDetailSerializer
 
    def get_queryset(self):
        return Vehicle.objects.filter(vendor=self.request.user).select_related(
            'city', 'pickup_location').prefetch_related('photos', 'documents')
 
    def perform_create(self, serializer):
        # 1. Save the vehicle first (existing line)
        vehicle = serializer.save(vendor=self.request.user)

        # 2. Handle suggested location from the map picker
        #    Only runs when the vendor dropped a pin that didn't match
        #    any existing Location record within 30 km.
        suggested_name    = self.request.data.get('suggested_location_name')
        suggested_address = self.request.data.get('suggested_location_address')
        suggested_lat     = self.request.data.get('suggested_location_lat')
        suggested_lng     = self.request.data.get('suggested_location_lng')

        if suggested_name and not vehicle.pickup_location:
            # Resolve the City object from the vehicle's city FK
            city = vehicle.city  # already a City instance after serializer.save()

            Location.objects.get_or_create(
                city=city,
                name=suggested_name,
                defaults={
                    'location_type': 'vendor_lot',
                    'address':       suggested_address or '',
                    'latitude':      suggested_lat or None,
                    'longitude':     suggested_lng or None,
                    'is_active':     False,   # Admin must review and activate
                }
            )
 
    @action(detail=True, methods=['post'], url_path='toggle')
    def toggle_active(self, request, pk=None):
        """Vendor can toggle between LIVE and INACTIVE."""
        vehicle = self.get_object()
        if vehicle.status == 'LIVE':
            vehicle.status = 'INACTIVE'
        elif vehicle.status in ['INACTIVE', 'CERTIFIED']:
            vehicle.status = 'LIVE'
        else:
            return Response(
                {'error': 'Vehicle must be CERTIFIED or LIVE to toggle.'},
                status=400,
            )
        vehicle.save()
        return Response({'status': vehicle.status})
 
 
class VehicleDocUploadView(APIView):
    """
    POST /api/vehicles/{vehicle_id}/docs/upload/
    Vendor uploads one document at a time.
    Body: multipart/form-data with fields: doc_type, file, expiry_date (optional)
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id, vendor=request.user)
        s = VehicleDocumentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        # Use update_or_create so re-uploading replaces the previous file
        doc, _ = VehicleDocument.objects.update_or_create(
            vehicle=vehicle, doc_type=s.validated_data['doc_type'],
            defaults={'file': s.validated_data['file'],
                      'expiry_date': s.validated_data.get('expiry_date'),
                      'status': 'pending'},
        )
        # After upload, check if all required docs are present -> advance status
        _check_and_advance_status(vehicle)
        return Response(VehicleDocumentSerializer(doc).data, status=201)
 
 
class VehiclePhotoUploadView(APIView):
    """
    POST /api/vehicles/{vehicle_id}/photos/upload/
    Vendor uploads one photo at a time.
    Body: multipart/form-data with fields: image, angle, is_cover
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id, vendor=request.user)
        s = VehiclePhotoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data.get('is_cover'):
            # Unset previous cover
            vehicle.photos.update(is_cover=False)
        photo = s.save(vehicle=vehicle)
        return Response(VehiclePhotoSerializer(photo).data, status=201)
 
 
# ── Internal helper: auto-advance status ─────────────────────────────────
def _check_and_advance_status(vehicle):
    """
    After each document upload, check if vehicle has all required docs.
    If yes, advance status to DOCS_SUBMITTED automatically.
    """
    required_docs = ['rc', 'insurance', 'puc']
    uploaded_types = list(
        vehicle.documents.values_list("doc_type", flat=True)
    )
    photo_count = vehicle.photos.count()
    if vehicle.status == 'PENDING_DOCS':
        all_docs_present = all(d in uploaded_types for d in required_docs)
        if all_docs_present and photo_count >= 10:
            vehicle.status = 'DOCS_SUBMITTED'
            vehicle.save(update_fields=["status"])
 
 
# ════════════════════════════════════════════════════════════════════════
# ADMIN VIEWS
# ════════════════════════════════════════════════════════════════════════
 
class AdminVehicleListView(generics.ListAPIView):
    """
    GET /api/vehicles/admin/?status=DOCS_SUBMITTED
    Admin sees all vehicles, filterable by status.
    """
    serializer_class   = VehicleDetailSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        qs = Vehicle.objects.select_related(
            'vendor', 'city').prefetch_related('photos', 'documents').all()
        s  = self.request.query_params.get("status")
        if s: qs = qs.filter(status=s)
        return qs
 
 
class AdminDocReviewView(APIView):
    """
    POST /api/vehicles/admin/docs/{doc_id}/review/
    Body: { "action": "approve" | "reject", "note": "..." }
    Admin approves or rejects one document.
    After all 3 required docs approved -> vehicle status -> ADMIN_APPROVED.
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request, doc_id):
        doc    = get_object_or_404(VehicleDocument, pk=doc_id)
        action = request.data.get("action")
        if action not in ['approve', 'reject']:
            return Response({'error': 'action must be approve or reject.'}, status=400)
 
        doc.status      = 'approved' if action == 'approve' else 'rejected'
        doc.admin_note  = request.data.get("note", "")
        doc.reviewed_at = timezone.now()
        doc.reviewed_by = request.user
        doc.save()
 
        vehicle = doc.vehicle
        _check_admin_approved(vehicle)
        return Response({'message': f'Document {doc.status}.', 'vehicle_status': vehicle.status})
 
 
def _check_admin_approved(vehicle):
    """After each doc review, check if all required docs are approved."""
    required_docs    = ['rc', 'insurance', 'puc']
    approved_docs    = list(vehicle.documents.filter(
        doc_type__in=required_docs,
        status='approved'
    ).values_list("doc_type", flat=True))
 
    if vehicle.status == 'DOCS_SUBMITTED':
        if all(d in approved_docs for d in required_docs):
            vehicle.status = 'ADMIN_APPROVED'
            vehicle.save(update_fields=["status"])
 
 
class AdminVehicleBlacklistView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/blacklist/
    Body: { "reason": "..." }
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        vehicle.is_blacklisted  = True
        vehicle.blacklist_reason = request.data.get("reason", "")
        vehicle.status          = 'INACTIVE'
        vehicle.save()
        return Response({'message': 'Vehicle blacklisted.'})


class AdminMechCertUploadView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/certify/
    Body: multipart/form-data: file (inspection report PDF),
          cert_date (YYYY-MM-DD), odometer_at_cert (integer)
 
    Admin uploads the mechanic certification report.
    System reads cert validity from config (never hardcoded).
    Assigns a unique Vehicle ID code and generates QR code.
    Advances status to CERTIFIED.
    """
    permission_classes = [IsAdminRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, vehicle_id):
        import datetime
        from dateutil.relativedelta import relativedelta
        from apps.configuration.utils import get_config
 
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
 
        cert_file = request.FILES.get("file")
        cert_date_str = request.data.get("cert_date")
        odo = request.data.get("odometer_at_cert", 0)
 
        if not cert_file or not cert_date_str:
            return Response({'error': 'file and cert_date are required.'}, status=400)
 
        # Save certification report as a document
        VehicleDocument.objects.update_or_create(
            vehicle=vehicle,
            doc_type='mechanic_cert',
            defaults={'file': cert_file, 'status': 'approved'},
        )
 
        # Read validity from config — admin can change these without code change
        validity_months = get_config("certification_validity_months", 6)
        validity_km     = get_config("certification_validity_km", 10000)
 
        cert_date = datetime.date.fromisoformat(cert_date_str)
        expiry_date = cert_date + relativedelta(months=validity_months)
        expiry_km   = int(odo) + validity_km
 
        # Assign unique Vehicle ID code if not already set
        if not vehicle.vehicle_id_code:
            state_code = vehicle.city.state[:2].upper() if vehicle.city else 'XX'
            vehicle.vehicle_id_code = f"CSI-{state_code}-{vehicle.id:05d}"
 
        vehicle.cert_expiry_date = expiry_date
        vehicle.cert_expiry_km   = expiry_km
        vehicle.is_certified     = True
        vehicle.status           = 'LIVE'
        vehicle.admin_note       = f'Certified on {cert_date}. Expires {expiry_date}.'
 
        # Generate QR code
        _generate_qr(vehicle)
        vehicle.save()
 
        return Response({
            'message':          'Vehicle certified and set to LIVE.',
            'vehicle_id_code':  vehicle.vehicle_id_code,
            'cert_expiry_date': str(expiry_date),
            'cert_expiry_km':   expiry_km,
        })



class VehicleQRScanView(APIView):
    """
    GET /api/vehicles/qr/{vehicle_id_code}/
    Public endpoint — anyone can scan the QR code to see vehicle profile.
    Returns vehicle details and certification status.
    """
    permission_classes = [permissions.AllowAny]
 
    def get(self, request, vehicle_id_code):
        vehicle = get_object_or_404(
            Vehicle,
            vehicle_id_code=vehicle_id_code,
            is_blacklisted=False,
        )
        return Response({
            'vehicle_id_code': vehicle.vehicle_id_code,
            'make':            vehicle.make,
            'model':           vehicle.model,
            'year':            vehicle.year,
            'plate_number':    vehicle.plate_number,
            'segment':         vehicle.get_segment_display(),
            'is_certified':    vehicle.is_certified,
            'cert_expiry_date':str(vehicle.cert_expiry_date) if vehicle.cert_expiry_date else None,
            'status':          vehicle.status,
            'qr_intact':       vehicle.qr_intact,
        })
 
 
class VehicleQRTamperFlagView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/flag-qr/
    Admin or inspector flags the QR sticker as tampered.
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        vehicle.qr_intact  = False
        vehicle.admin_note = (vehicle.admin_note or '') + ' | QR sticker tampered flag raised.'
        vehicle.save()
        return Response({'message': 'QR tamper flag set.'})


 
class VehicleSearchView(generics.ListAPIView):
    """
    GET /api/vehicles/search/
    Query params:
      city           (required)  - city ID
      pickup_date    (required)  - YYYY-MM-DD
      return_date    (required)  - YYYY-MM-DD
      segment        (optional)  - hatchback|sedan|suv|luxury|van|truck
      fuel_type      (optional)  - petrol|diesel|electric|hybrid|cng
      transmission   (optional)  - manual|automatic
      min_price      (optional)  - minimum daily rate
      max_price      (optional)  - maximum daily rate
      certified_only (optional)  - true|false
    """
    serializer_class   = VehicleListSerializer
    permission_classes = [permissions.AllowAny]
 
    def get_queryset(self):
        p = self.request.query_params
        city        = p.get("city")
        pickup_date = p.get("pickup_date")
        return_date = p.get("return_date")
 
        if not city or not pickup_date or not return_date:
            return Vehicle.objects.none()
 
        import datetime
        try:
            p_date = datetime.date.fromisoformat(pickup_date)
            r_date = datetime.date.fromisoformat(return_date)
        except ValueError:
            return Vehicle.objects.none()
 
        # Build date range between pickup and return
        date_range = []
        d = p_date
        while d <= r_date:
            date_range.append(d)
            d += datetime.timedelta(days=1)
 
        # Find vehicles that have ANY of these dates blocked
        blocked_ids = VehicleAvailability.objects.filter(
            blocked_date__in=date_range
        ).values_list("vehicle_id", flat=True)
 
        # Base queryset: LIVE, in the requested city, not blocked, not blacklisted
        qs = Vehicle.objects.filter(
            status='LIVE',
            city_id=city,
            is_blacklisted=False,
        ).exclude(id__in=blocked_ids).select_related(
            'city', 'vendor__vendor_profile'
        ).prefetch_related('photos')
 
        # Optional filters
        if p.get("segment"):
            qs = qs.filter(segment=p.get("segment"))
        if p.get("fuel_type"):
            qs = qs.filter(fuel_type=p.get("fuel_type"))
        if p.get("transmission"):
            qs = qs.filter(transmission=p.get("transmission"))
        if p.get("min_price"):
            qs = qs.filter(daily_rate__gte=p.get("min_price"))
        if p.get("max_price"):
            qs = qs.filter(daily_rate__lte=p.get("max_price"))
        if p.get('certified_only') == 'true':
            qs = qs.filter(is_certified=True)
 
        return qs
 
 
class VehicleDetailPublicView(generics.RetrieveAPIView):
    """
    GET /api/vehicles/{id}/
    Public: anyone can view a vehicle detail page.
    Returns full vehicle info including photos and certification status.
    """
    serializer_class   = VehicleDetailSerializer
    permission_classes = [permissions.AllowAny]
 
    def get_queryset(self):
        return Vehicle.objects.filter(
            status='LIVE', is_blacklisted=False
        ).prefetch_related('photos', 'documents').select_related('city', 'vendor__vendor_profile')


 
class AvailabilityView(APIView):
    """
    GET  /api/vehicles/{vehicle_id}/availability/?month=2025-06
         Returns all blocked dates for a month.
 
    POST /api/vehicles/{vehicle_id}/availability/block/
         Body: { "dates": ["2025-06-10", "2025-06-11"] }
         Vendor manually blocks dates (e.g. for maintenance).
 
    POST /api/vehicles/{vehicle_id}/availability/unblock/
         Body: { "dates": ["2025-06-10"] }
         Vendor unblocks manually-blocked dates.
         Note: booking-blocked dates cannot be unblocked by vendor.
    """
 
    def _get_vehicle(self, request, vehicle_id):
        """Return vehicle only if caller is the vendor owner."""
        return get_object_or_404(Vehicle, pk=vehicle_id, vendor=request.user)
 
    def get(self, request, vehicle_id):
        month_str = request.query_params.get("month")  # e.g. "2025-06"
        qs = VehicleAvailability.objects.filter(vehicle_id=vehicle_id)
        if month_str:
            try:
                import datetime
                year, month = map(int, month_str.split("-"))
                qs = qs.filter(blocked_date__year=year, blocked_date__month=month)
            except ValueError:
                pass
        dates = list(qs.values_list("blocked_date", flat=True))
        return Response({'blocked_dates': [str(d) for d in dates]})
 
    def post_block(self, request, vehicle_id):
        vehicle = self._get_vehicle(request, vehicle_id)
        dates   = request.data.get("dates", [])
        created = 0
        for d in dates:
            _, was_created = VehicleAvailability.objects.get_or_create(
                vehicle=vehicle,
                blocked_date=d,
                defaults={'reason': 'manual'},
            )
            if was_created: created += 1
        return Response({'blocked': created, 'total_requested': len(dates)})
 
    def post_unblock(self, request, vehicle_id):
        vehicle = self._get_vehicle(request, vehicle_id)
        dates   = request.data.get("dates", [])
        deleted, _ = VehicleAvailability.objects.filter(
            vehicle=vehicle,
            blocked_date__in=dates,
            reason='manual',   # Only vendor-blocked dates can be unblocked
        ).delete()
        return Response({'unblocked': deleted})


class VehicleAdminStatsView(APIView):
    """GET /api/vehicles/admin/stats/ — counts per status for admin dashboard."""
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from django.db.models import Count
        counts = Vehicle.objects.values("status").annotate(count=Count("id"))
        return Response({item["status"]: item["count"] for item in counts})
 
class VAHANCheckView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/vahan-check/
    Stub for VAHAN API verification.
    In production: replace _call_vahan_api with real API call.
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        result  = _call_vahan_api(vehicle.plate_number)
        if result.get("blacklisted"):
            vehicle.is_blacklisted   = True
            vehicle.blacklist_reason = "Flagged by VAHAN database."
            vehicle.status           = 'INACTIVE'
            vehicle.save()
        return Response({'vahan_result': result, 'vehicle_status': vehicle.status})
 
 
def _call_vahan_api(plate_number):
    """
    DEV STUB — always returns clean result.
    Replace this function body with real VAHAN API call in production.
    """
    return {
        'plate_number': plate_number,
        'blacklisted':  False,
        'message':      'STUB: Vehicle not flagged (development mode).',
    }
