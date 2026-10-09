import qrcode
import io
from django.core.files.base import ContentFile
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.locations.models import Location, City
 
from .models import Vehicle, VehicleDocument, VehiclePhoto, VehicleAvailability
from .serializers import (
    VehicleListSerializer, VehicleDetailSerializer, VehicleCreateSerializer,
    VehicleDocumentSerializer, VehiclePhotoSerializer, VehicleAvailabilitySerializer, VehicleVendorUpdateSerializer
)
from decimal import Decimal
 
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
 
# class VendorVehicleViewSet(viewsets.ModelViewSet):
#     """
#     CRUD for a vendor's own vehicles.
#     GET  /api/vehicles/vendor/             -> list my vehicles
#     POST /api/vehicles/vendor/             -> create a new listing
#     GET  /api/vehicles/vendor/{id}/        -> single vehicle detail
#     PATCH /api/vehicles/vendor/{id}/       -> edit vehicle info
#     POST /api/vehicles/vendor/{id}/toggle/ -> activate or deactivate listing
#     """
#     permission_classes = [IsVendorRole]
#     parser_classes     = [MultiPartParser, FormParser]
 
#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return VehicleCreateSerializer
#         return VehicleDetailSerializer
 
#     def get_queryset(self):
#         return Vehicle.objects.filter(vendor=self.request.user).select_related(
#             'city', 'pickup_location').prefetch_related('photos', 'documents')
 
#     def perform_create(self, serializer):
#         # 1. Save the vehicle first (existing line)
#         vehicle = serializer.save(vendor=self.request.user)

#         # 2. Handle suggested location from the map picker
#         #    Only runs when the vendor dropped a pin that didn't match
#         #    any existing Location record within 30 km.
#         suggested_name    = self.request.data.get('suggested_location_name')
#         suggested_address = self.request.data.get('suggested_location_address')
#         suggested_lat     = self.request.data.get('suggested_location_lat')
#         suggested_lng     = self.request.data.get('suggested_location_lng')

#         if suggested_name and not vehicle.pickup_location:
#             # Resolve the City object from the vehicle's city FK
#             city = vehicle.city  # already a City instance after serializer.save()

#             Location.objects.get_or_create(
#                 city=city,
#                 name=suggested_name,
#                 defaults={
#                     'location_type': 'vendor_lot',
#                     'address':       suggested_address or '',
#                     'latitude':      suggested_lat or None,
#                     'longitude':     suggested_lng or None,
#                     'is_active':     False,   # Admin must review and activate
#                 }
#             )
 
#     @action(detail=True, methods=['post'], url_path='toggle')
#     def toggle_active(self, request, pk=None):
#         """Vendor can toggle between LIVE and INACTIVE."""
#         vehicle = self.get_object()
#         if vehicle.status == 'LIVE':
#             vehicle.status = 'INACTIVE'
#         elif vehicle.status in ['INACTIVE', 'CERTIFIED']:
#             vehicle.status = 'LIVE'
#         else:
#             return Response(
#                 {'error': 'Vehicle must be CERTIFIED or LIVE to toggle.'},
#                 status=400,
#             )
#         vehicle.save()
#         return Response({'status': vehicle.status})
 
 
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
        qs = Vehicle.objects.select_related('vendor__vendor_profile', 'city').prefetch_related('photos', 'documents').all()
        s  = self.request.query_params.get("status")
        if s: qs = qs.filter(status=s)
        if self.request.query_params.get('needs_review') == 'true':
            qs = qs.filter(needs_review=True)
        if self.request.query_params.get('needs_reverification') == 'true':
            qs = qs.filter(needs_reverification=True)
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
            current_city_id=city,
            is_blacklisted=False,
        ).exclude(id__in=blocked_ids).select_related(
            'city', 'current_city', 'pickup_location',
            'vendor__vendor_profile__pickup_location',).prefetch_related('photos')
 
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
    permission_classes = [IsAdminRole]

    def get(self, request):
        from django.db.models import Count
        counts = Vehicle.objects.values("status").annotate(count=Count("id"))
        result = {item["status"]: item["count"] for item in counts}
        result['_needs_review']         = Vehicle.objects.filter(needs_review=True).count()
        result['_needs_reverification'] = Vehicle.objects.filter(needs_reverification=True).count()
        return Response(result)
 
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


class AdminVehicleSetStatusView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/set-status/
    Admin directly overrides a vehicle's status.
 
    Body: { "status": "PENDING_DOCS" | "DOCS_SUBMITTED" | "ADMIN_APPROVED" | "LIVE" | "INACTIVE", "note": "..." }
 
    Use cases:
      - Push a vehicle back to PENDING_DOCS / DOCS_SUBMITTED for re-submission
      - Manually mark INACTIVE (soft deactivation, without blacklisting)
      - Promote to LIVE after manual off-platform verification
      - Demote from LIVE back to ADMIN_APPROVED if a doc expires
    """
    permission_classes = [IsAdminRole]
 
    ALLOWED_STATUSES = ['PENDING_DOCS', 'DOCS_SUBMITTED', 'ADMIN_APPROVED', 'LIVE', 'INACTIVE']
 
    def post(self, request, vehicle_id):
        vehicle    = get_object_or_404(Vehicle, pk=vehicle_id)
        new_status = request.data.get('status', '').upper()
        note       = request.data.get('note', '')
 
        if new_status not in self.ALLOWED_STATUSES:
            return Response(
                {'error': f'status must be one of: {", ".join(self.ALLOWED_STATUSES)}'},
                status=400,
            )
 
        old_status       = vehicle.status
        vehicle.status   = new_status
        if note:
            vehicle.admin_note = note
 
        # If promoting to LIVE, also flag as certified so frontend shows it correctly
        if new_status == 'LIVE' and not vehicle.is_certified:
            vehicle.is_certified = True
 
        vehicle.save(update_fields=['status', 'admin_note', 'is_certified', 'updated_at'])
 
        return Response({
            'message':     f'Vehicle status changed from {old_status} → {new_status}.',
            'old_status':  old_status,
            'new_status':  new_status,
            'vehicle_id':  vehicle.id,
        })
    

class VehicleSegmentSearchView(APIView):
    """
    GET /api/vehicles/segments/
    Query params:
      city          (required) - city ID
      pickup_date   (required) - YYYY-MM-DD
      return_date   (required) - YYYY-MM-DD

    Returns the list of vehicle segments that have at least one available
    vehicle in the requested city + date range, along with counts and
    price ranges.  Used by the new SegmentSelectPage (booking Step 1).
    """
    permission_classes = [permissions.AllowAny]

    # Static metadata — icon, human label, marketing blurb.
    # These never change at runtime; no DB hit needed.
    SEGMENT_META = {
        'hatchback': {'icon': '🚗', 'label': 'Hatchback', 'desc': 'Compact & fuel-efficient'},
        'sedan':     {'icon': '🚘', 'label': 'Sedan',     'desc': 'Comfortable family cars'},
        'suv':       {'icon': '🚙', 'label': 'SUV',       'desc': 'Spacious & versatile'},
        'luxury':    {'icon': '🏎️', 'label': 'Luxury',    'desc': 'Premium experience'},
        'van':       {'icon': '🚐', 'label': 'Van / MPV', 'desc': 'Group & cargo trips'},
        'truck':     {'icon': '🚛', 'label': 'Truck',     'desc': 'Heavy-duty & cargo'},
    }
    SEGMENT_ORDER = ['hatchback', 'sedan', 'suv', 'luxury', 'van', 'truck']

    def get(self, request):
        import datetime
        from django.db.models import Count, Min, Max

        p = request.query_params
        city        = p.get('city')
        pickup_date = p.get('pickup_date')
        return_date = p.get('return_date')

        if not city or not pickup_date or not return_date:
            return Response(
                {'error': 'city, pickup_date, and return_date are required.'},
                status=400,
            )

        try:
            p_date = datetime.date.fromisoformat(pickup_date)
            r_date = datetime.date.fromisoformat(return_date)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        if r_date < p_date:
            return Response({'error': 'return_date cannot be before pickup_date.'}, status=400)

        # ── Collect all dates in the rental window ────────────────────────
        date_range = []
        d = p_date
        while d <= r_date:
            date_range.append(d)
            d += datetime.timedelta(days=1)

        # ── Exclude vehicles blocked on ANY date in the window ────────────
        blocked_ids = VehicleAvailability.objects.filter(
            blocked_date__in=date_range
        ).values_list('vehicle_id', flat=True)

        available_qs = Vehicle.objects.filter(
            status='LIVE',
            city_id=city,
            is_blacklisted=False,
        ).exclude(id__in=blocked_ids)

        # ── Aggregate by segment (one query) ─────────────────────────────
        segment_stats = (
            available_qs
            .values('segment')
            .annotate(
                vehicle_count=Count('id'),
                vendor_count=Count('vendor', distinct=True),
                min_rate=Min('daily_rate'),
                max_rate=Max('daily_rate'),
                certified_count=Count('id', filter=__import__(
                    'django.db.models', fromlist=['Q']).Q(is_certified=True)),
            )
        )

        # ── Build response, enriched with static metadata ─────────────────
        stats_by_seg = {row['segment']: row for row in segment_stats}
        result = []

        for seg in self.SEGMENT_ORDER:
            if seg not in stats_by_seg:
                continue          # segment has no available vehicles — omit
            row  = stats_by_seg[seg]
            meta = self.SEGMENT_META.get(seg, {
                'icon': '🚗', 'label': seg.title(), 'desc': '',
            })
            result.append({
                'segment':          seg,
                'icon':             meta['icon'],
                'label':            meta['label'],
                'desc':             meta['desc'],
                'vehicle_count':    row['vehicle_count'],
                'vendor_count':     row['vendor_count'],
                'certified_count':  row['certified_count'],
                'min_rate':         str(row['min_rate']),
                'max_rate':         str(row['max_rate']),
            })

        # Append any unknown segments not in the canonical order
        for seg, row in stats_by_seg.items():
            if seg not in self.SEGMENT_ORDER:
                meta = self.SEGMENT_META.get(seg, {
                    'icon': '🚗', 'label': seg.title(), 'desc': '',
                })
                result.append({
                    'segment':          seg,
                    'icon':             meta['icon'],
                    'label':            meta['label'],
                    'desc':             meta['desc'],
                    'vehicle_count':    row['vehicle_count'],
                    'vendor_count':     row['vendor_count'],
                    'certified_count':  row.get('certified_count', 0),
                    'min_rate':         str(row['min_rate']),
                    'max_rate':         str(row['max_rate']),
                })

        return Response({'segments': result, 'city_id': city})


# class VendorVehicleViewSet(viewsets.ModelViewSet):
#     permission_classes = [IsVendorRole]
#     parser_classes     = [MultiPartParser, FormParser, JSONParser]

#     # Fields that, if changed on an already-reviewed vehicle, must alert admin
#     FIELDS_THAT_TRIGGER_REVIEW = {
#         'make', 'model', 'year', 'colour', 'segment', 'fuel_type',
#         'transmission', 'capacity', 'daily_rate', 'city', 'pickup_location',
#     }
#     # Statuses past initial review — an edit here is a change to something admin already signed off on
#     REVIEWED_STATUSES = {'ADMIN_APPROVED', 'CERTIFIED', 'LIVE', 'INACTIVE'}

#     def get_serializer_class(self):
#         if self.action == 'create':
#             return VehicleCreateSerializer
#         if self.action in ('update', 'partial_update'):
#             return VehicleVendorUpdateSerializer
#         return VehicleDetailSerializer

#     def get_queryset(self):
#         return Vehicle.objects.filter(vendor=self.request.user).select_related(
#             'city', 'pickup_location').prefetch_related('photos', 'documents')

#     def perform_create(self, serializer):
#         vehicle = serializer.save(
#             vendor=self.request.user,
#             current_odometer=serializer.validated_data.get('odometer_at_listing', 0),
#             last_verified_odometer=serializer.validated_data.get('odometer_at_listing', 0),
#         )
#         # ...existing suggested_location logic stays unchanged...
#         suggested_name    = self.request.data.get('suggested_location_name')
#         suggested_address = self.request.data.get('suggested_location_address')
#         suggested_lat     = self.request.data.get('suggested_location_lat')
#         suggested_lng     = self.request.data.get('suggested_location_lng')
#         if suggested_name and not vehicle.pickup_location:
#             city = vehicle.city
#             Location.objects.get_or_create(
#                 city=city, name=suggested_name,
#                 defaults={
#                     'location_type': 'vendor_lot',
#                     'address':       suggested_address or '',
#                     'latitude':      suggested_lat or None,
#                     'longitude':     suggested_lng or None,
#                     'is_active':     False,
#                 }
#             )

#     def perform_update(self, serializer):
#         from apps.configuration.utils import get_config
#         from django.utils import timezone

#         instance = self.get_object()
#         before = {f: getattr(instance, f) for f in self.FIELDS_THAT_TRIGGER_REVIEW}

#         vehicle = serializer.save()

#         changed = [f for f in self.FIELDS_THAT_TRIGGER_REVIEW
#                    if str(before[f]) != str(getattr(vehicle, f))]

#         update_fields = set()

#         # ── 1. Flag vendor edits to already-reviewed vehicles ──────────
#         if changed and vehicle.status in self.REVIEWED_STATUSES:
#             vehicle.needs_review = True
#             vehicle.last_edited_at = timezone.now()
#             vehicle.last_edit_summary = f"Vendor updated: {', '.join(changed)}."
#             update_fields |= {'needs_review', 'last_edited_at', 'last_edit_summary'}

#         # ── 2. Odometer-based re-verification ───────────────────────────
#         if vehicle.current_odometer is not None:
#             if vehicle.last_verified_odometer is None:
#                 vehicle.last_verified_odometer = vehicle.odometer_at_listing or 0
#                 update_fields.add('last_verified_odometer')

#             threshold = get_config('odometer_reverification_km', 10000)
#             distance_travelled = vehicle.current_odometer - (vehicle.last_verified_odometer or 0)
#             should_flag = distance_travelled >= threshold

#             if should_flag != vehicle.needs_reverification:
#                 vehicle.needs_reverification = should_flag
#                 update_fields.add('needs_reverification')

#             if should_flag and vehicle.status in self.REVIEWED_STATUSES:
#                 note = (f"Odometer at {vehicle.current_odometer} km — "
#                          f"{distance_travelled} km since last verification "
#                          f"(threshold {threshold} km).")
#                 vehicle.needs_review = True
#                 vehicle.last_edited_at = timezone.now()
#                 vehicle.last_edit_summary = (
#                     f"{vehicle.last_edit_summary} {note}".strip()
#                     if vehicle.last_edit_summary else note
#                 )
#                 update_fields |= {'needs_review', 'last_edited_at', 'last_edit_summary'}

#         if update_fields:
#             vehicle.save(update_fields=list(update_fields))

#     @action(detail=True, methods=['post'], url_path='toggle')
#     def toggle_active(self, request, pk=None):
#         # ...unchanged...
#         vehicle = self.get_object()
#         if vehicle.status == 'LIVE':
#             vehicle.status = 'INACTIVE'
#         elif vehicle.status in ['INACTIVE', 'CERTIFIED']:
#             vehicle.status = 'LIVE'
#         else:
#             return Response({'error': 'Vehicle must be CERTIFIED or LIVE to toggle.'}, status=400)
#         vehicle.save()
#         return Response({'status': vehicle.status})



# class AdminAcknowledgeEditView(APIView):
#     """
#     POST /api/vehicles/admin/{vehicle_id}/acknowledge-edit/
#     Admin dismisses the "vendor edited this" flag after reviewing the change.
#     """
#     permission_classes = [IsAdminRole]

#     def post(self, request, vehicle_id):
#         vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
#         vehicle.needs_review = False
#         vehicle.admin_reviewed_edit_at = timezone.now()
#         vehicle.save(update_fields=['needs_review', 'admin_reviewed_edit_at'])
#         return Response({'message': 'Marked as reviewed.'})
class AdminApproveVehicleEditView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/approve-edit/
    Applies the vendor's staged pending_changes to the live vehicle record.
    This is the ONLY code path that writes a vendor edit onto live fields
    once a vehicle has passed initial review.
    """
    permission_classes = [IsAdminRole]

    FIELD_CASTERS = {
        'year':             int,
        'capacity':         int,
        'daily_rate':       lambda v: Decimal(str(v)),
        'current_odometer': int,
    }

    def post(self, request, vehicle_id):
        from apps.notifications.utils import notify

        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        pending = vehicle.pending_changes or {}
        if not pending:
            return Response({'message': 'No pending changes to approve.'})

        odometer_changed = 'current_odometer' in pending

        for field, raw_value in pending.items():
            if field == 'city':
                try:
                    setattr(vehicle, field, City.objects.get(pk=raw_value))
                except City.DoesNotExist:
                    continue
            elif field == 'pickup_location':
                if raw_value:
                    try:
                        setattr(vehicle, field, Location.objects.get(pk=raw_value))
                    except Location.DoesNotExist:
                        pass
                else:
                    setattr(vehicle, field, None)
            else:
                caster = self.FIELD_CASTERS.get(field)
                setattr(vehicle, field, caster(raw_value) if caster else raw_value)

        vehicle.pending_changes        = {}
        vehicle.pending_submitted_at   = None
        vehicle.needs_review           = False
        vehicle.admin_reviewed_edit_at = timezone.now()
        vehicle.last_edit_summary      = f"Edits approved by admin on {vehicle.admin_reviewed_edit_at:%d %b %Y, %H:%M}."

        # Recompute the distance-based re-verification flag now that
        # current_odometer is actually live.
        if odometer_changed and vehicle.current_odometer is not None:
            from apps.configuration.utils import get_config
            threshold = get_config('odometer_reverification_km', 10000)
            baseline  = vehicle.last_verified_odometer or 0
            if (vehicle.current_odometer - baseline) >= threshold:
                vehicle.needs_reverification = True

        vehicle.save()
        
        notify(
            vehicle.vendor,
            title="Vehicle edit approved",
            message=f"Your changes to {vehicle.year} {vehicle.make} {vehicle.model} were approved and are now live.",
            notification_type='vehicle_edit_decided',
            link_url=f'/vendor?tab=fleet&highlight={vehicle.id}',
        )
        return Response({
            'message': 'Vendor changes approved and applied.',
            'vehicle': VehicleDetailSerializer(vehicle).data,
        })



class AdminRejectVehicleEditView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/reject-edit/
    Body: { "reason": "..." }  (optional)
    Discards the vendor's staged changes. Live vehicle data is untouched.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, vehicle_id):
        from apps.notifications.utils import notify
        
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        if not vehicle.pending_changes:
            return Response({'message': 'No pending changes to reject.'})

        reason = request.data.get('reason', '')
        vehicle.pending_changes        = {}
        vehicle.pending_submitted_at   = None
        vehicle.needs_review           = False
        vehicle.admin_reviewed_edit_at = timezone.now()
        vehicle.last_edit_summary = (
            'Vendor changes rejected by admin.' + (f' Reason: {reason}' if reason else '')
        )
        vehicle.save(update_fields=[
            'pending_changes', 'pending_submitted_at', 'needs_review',
            'admin_reviewed_edit_at', 'last_edit_summary',
        ])

        notify(
            vehicle.vendor,
            title="Vehicle edit rejected",
            message=f"Your submitted changes to {vehicle.year} {vehicle.make} {vehicle.model} were rejected." + (f" Reason: {reason}" if reason else ""),
            notification_type='vehicle_edit_decided',
            link_url=f'/vendor?tab=fleet&highlight={vehicle.id}',
        )
        return Response({'message': 'Vendor changes rejected. Live data unchanged.'})

class AdminCompleteReverificationView(APIView):
    """
    POST /api/vehicles/admin/{vehicle_id}/complete-reverification/
    Admin confirms they've re-inspected the vehicle at its current odometer
    reading. Resets the re-verification distance clock.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        vehicle.last_verified_odometer = vehicle.current_odometer or vehicle.last_verified_odometer
        vehicle.needs_reverification   = False
        vehicle.needs_review           = False
        vehicle.admin_reviewed_edit_at = timezone.now()
        vehicle.save(update_fields=[
            'last_verified_odometer', 'needs_reverification',
            'needs_review', 'admin_reviewed_edit_at',
        ])
        return Response({'message': 'Re-verification recorded. Odometer clock reset.'})


class VendorVehicleViewSet(viewsets.ModelViewSet):
    """
    CRUD for a vendor's own vehicles.
    GET  /api/vehicles/vendor/             -> list my vehicles
    POST /api/vehicles/vendor/             -> create a new listing (multipart — supports files)
    GET  /api/vehicles/vendor/{id}/        -> single vehicle detail
    PATCH /api/vehicles/vendor/{id}/       -> edit vehicle info

    IMPORTANT — approval gate:
    Once a vehicle has passed initial review (ADMIN_APPROVED / CERTIFIED / LIVE /
    INACTIVE), a vendor's PATCH is NEVER written directly to the live fields.
    It is staged in `pending_changes`, `needs_review` is set, and the response
    reflects the vehicle's still-unchanged approved values. Only an admin
    approve-edit call applies the staged values.

    Vehicles that haven't been reviewed yet (PENDING_DOCS / DOCS_SUBMITTED)
    have no approved baseline to protect, so edits there apply immediately —
    vendors can freely correct onboarding details before first review.
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    FIELDS_THAT_TRIGGER_REVIEW = {
        'make', 'model', 'year', 'colour', 'segment', 'fuel_type',
        'transmission', 'capacity', 'daily_rate', 'city', 'pickup_location',
        'current_odometer',
    }
    REVIEWED_STATUSES = {'ADMIN_APPROVED', 'CERTIFIED', 'LIVE', 'INACTIVE'}

    def get_serializer_class(self):
        if self.action == 'create':
            return VehicleCreateSerializer
        if self.action in ('update', 'partial_update'):
            return VehicleVendorUpdateSerializer
        return VehicleDetailSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(vendor=self.request.user).select_related(
            'city', 'pickup_location').prefetch_related('photos', 'documents')

    def perform_create(self, serializer):
        from apps.notifications.utils import notify_admins_for_vendor

        vehicle = serializer.save(
            vendor=self.request.user,
            current_odometer=serializer.validated_data.get('odometer_at_listing', 0),
            last_verified_odometer=serializer.validated_data.get('odometer_at_listing', 0),
            current_city=serializer.validated_data.get('city'),   # ← NEW: starts at home city
        )
        
        suggested_name    = self.request.data.get('suggested_location_name')
        suggested_address = self.request.data.get('suggested_location_address')
        suggested_lat     = self.request.data.get('suggested_location_lat')
        suggested_lng     = self.request.data.get('suggested_location_lng')
        if suggested_name and not vehicle.pickup_location:
            city = vehicle.city
            Location.objects.get_or_create(
                city=city, name=suggested_name,
                defaults={
                    'location_type': 'vendor_lot',
                    'address':       suggested_address or '',
                    'latitude':      suggested_lat or None,
                    'longitude':     suggested_lng or None,
                    'is_active':     False,
                }
            )
        
        try:
            business_name = self.request.user.vendor_profile.business_name
        except Exception:
            business_name = self.request.user.full_name or self.request.user.email
        notify_admins_for_vendor(
            self.request.user,
            title="New vehicle listed",
            message=f"{business_name} listed a {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.plate_number}).",
            notification_type='vehicle_added',
            link_url=f'/admin?tab=vehicles&highlight={vehicle.id}',
        )

    def perform_update(self, serializer):
        from apps.notifications.utils import notify_admins_for_vendor

        instance = serializer.instance

        if instance.status not in self.REVIEWED_STATUSES:
            # No approved baseline yet — apply directly.
            serializer.save()
            return

        # ── Gate: stage the diff, never touch live fields ──────────────
        validated_data = serializer.validated_data
        changed = {}
        for field, new_value in validated_data.items():
            old_value = getattr(instance, field)
            norm_new = new_value.pk if hasattr(new_value, 'pk') else new_value
            norm_old = old_value.pk if hasattr(old_value, 'pk') else old_value
            if str(norm_old) != str(norm_new):
                changed[field] = str(norm_new) if norm_new is not None else None

        if not changed:
            return  # nothing actually changed — instance untouched

        pending = dict(instance.pending_changes or {})
        pending.update(changed)

        instance.pending_changes      = pending
        instance.pending_submitted_at = timezone.now()
        instance.needs_review         = True
        instance.last_edited_at       = timezone.now()
        instance.last_edit_summary    = (
            f"Vendor submitted changes to: {', '.join(sorted(changed.keys()))}. "
            f"Awaiting admin approval — live values unchanged until approved."
        )
        instance.save(update_fields=[
            'pending_changes', 'pending_submitted_at', 'needs_review',
            'last_edited_at', 'last_edit_summary',
        ])
        
        notify_admins_for_vendor(
            instance.vendor,
            title="Vendor edited vehicle details",
            message=f"Changes submitted for {instance.year} {instance.make} {instance.model} ({instance.plate_number}). Awaiting your approval.",
            notification_type='vehicle_edit_pending',
            link_url=f'/admin?tab=vehicles&highlight={instance.id}',
        )
        # NOTE: serializer.save() is deliberately never called on this path.
        # Calling it would write validated_data straight onto the model,
        # bypassing the approval gate entirely — this was the original bug.

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance.refresh_from_db()
        # Always return the FULL detail representation — including
        # pending_changes / needs_review — regardless of which serializer
        # validated the input, so the vendor UI can show what's pending.
        return Response(VehicleDetailSerializer(instance, context=self.get_serializer_context()).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='toggle')
    def toggle_active(self, request, pk=None):
        vehicle = self.get_object()
        if vehicle.status == 'LIVE':
            vehicle.status = 'INACTIVE'
        elif vehicle.status in ['INACTIVE', 'CERTIFIED']:
            vehicle.status = 'LIVE'
        else:
            return Response({'error': 'Vehicle must be CERTIFIED or LIVE to toggle.'}, status=400)
        vehicle.save()
        return Response({'status': vehicle.status})