from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
 
from apps.configuration.utils import get_config
from apps.bookings.models import Booking
 
from .models import VendorNetwork, ReturnPoint, HandoverRecord, HandoverPhoto, RevenueShare
from .serializers import (
    VendorNetworkSerializer, ReturnPointSerializer,
    HandoverRecordSerializer, HandoverPhotoSerializer, RevenueShareSerializer, VendorCommissionOverrideSerializer, CityParkingRateSerializer,
    CityParkingRate, VendorCommissionOverride,
)
 
 
# ── Role permission helpers ──────────────────────────────────────────────
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'admin'
 
class IsVendorRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'vendor'
 
 
# ════════════════════════════════════════════════════════════════════════
# RETURN POINT DIRECTORY
# ════════════════════════════════════════════════════════════════════════
 
class ReturnPointListView(generics.ListCreateAPIView):
    """
    GET  /api/logistics/return-points/?city=2   — public, called during booking wizard
    POST /api/logistics/return-points/          — admin only, registers a new parking lot

    Body for POST: {
        "city": <id>, "name": "...", "point_type": "parking",
        "address": "...", "latitude": ..., "longitude": ...,
        "contact_phone": "..."
    }
    point_type='partner_vendor' entries are auto-created by the system when
    a vendor opts into VendorNetwork for a city (see VendorNetworkOptInView) —
    admins should only ever create point_type='parking' entries manually here.
    """
    serializer_class = ReturnPointSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminRole()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs   = ReturnPoint.objects.filter(is_active=True).select_related(
            'city', 'vendor_network_member__vendor__vendor_profile')
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city_id=city)
        return qs

    def perform_create(self, serializer):
        serializer.save(point_type='parking')  # admin lots are always this type
 
 
class ReturnPointDetailView(generics.RetrieveAPIView):
    """GET /api/logistics/return-points/{id}/"""
    serializer_class   = ReturnPointSerializer
    permission_classes = [permissions.AllowAny]
    queryset           = ReturnPoint.objects.filter(is_active=True)


class VendorNetworkOptInView(APIView):
    """
    GET  /api/logistics/network/my/      — list my current network memberships
    POST /api/logistics/network/opt-in/  — join the network for a city
    Body: { "city": city_id, "max_vehicles": 3 }
          NOTE: no fee field — pricing is set exclusively by admin via
          CityParkingRate + VendorCommissionOverride. Any fee-related keys
          in the request body are ignored.
    DELETE /api/logistics/network/{id}/  — leave the network for a city
    """
    permission_classes = [IsVendorRole]

    def get(self, request):
        qs = VendorNetwork.objects.filter(
            vendor=request.user).select_related("city")
        return Response(VendorNetworkSerializer(qs, many=True).data)

    def post(self, request):
        city_id = request.data.get("city")
        max_v   = request.data.get("max_vehicles", 3)

        if not city_id:
            return Response({'error': 'city is required.'}, status=400)

        membership, created = VendorNetwork.objects.update_or_create(
            vendor  = request.user,
            city_id = city_id,
            defaults={
                'is_active':    True,
                'max_vehicles': max_v,
                # handling_fee_override intentionally never set here
            }
        )
        msg = "Joined the network." if created else "Network membership updated."
        return Response({'message': msg, 'id': membership.id}, status=201 if created else 200)
 
 
class VendorNetworkDeleteView(APIView):
    """DELETE /api/logistics/network/{id}/ — opt out of a city"""
    permission_classes = [IsVendorRole]
 
    def delete(self, request, pk):
        membership = get_object_or_404(VendorNetwork, pk=pk, vendor=request.user)
        membership.is_active = False
        membership.save()
        return Response({'message': 'Left the network for this city.'})
 
 
class AdminNetworkListView(generics.ListAPIView):
    """GET /api/logistics/network/ — admin sees all network members"""
    serializer_class   = VendorNetworkSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        qs   = VendorNetwork.objects.filter(is_active=True).select_related(
            'vendor__vendor_profile', 'city')
        city = self.request.query_params.get('city')
        return qs.filter(city_id=city) if city else qs


def auto_match_return_partner(booking) -> HandoverRecord | None:
    """
    Called automatically after a cross-city booking is confirmed.
    Finds the best available partner vendor in the return city and
    creates a HandoverRecord.
 
    Selection criteria:
    1. Network member in the return city, is_active=True
    2. Not already at max_vehicles capacity
    3. Vendor with the most available capacity (fewest current held vehicles)
 
    Returns the created HandoverRecord, or None if no partner found.
    """
    if not booking.is_one_way or not booking.return_location:
        return None

    return_city = booking.return_location.city

    # ── Try vendor-network partners first (Option: vendor-provided parking) ──
    candidates = VendorNetwork.objects.filter(
        city=return_city,
        is_active=True,
    ).exclude(vendor=booking.vendor)

    best = None
    best_capacity = -1
    for member in candidates:
        currently_held = HandoverRecord.objects.filter(
            receiving_vendor = member.vendor,
            status__in       = ['RECEIVED', 'INSPECTED', 'HELD', 'SUBLISTED'],
        ).count()
        available = member.max_vehicles - currently_held
        if available > 0 and available > best_capacity:
            best          = member
            best_capacity = available

    if best:
        return_point, _ = ReturnPoint.objects.get_or_create(
            vendor_network_member = best,
            city                  = return_city,
            defaults = {
                'name':       f'{best.vendor.vendor_profile.business_name} Lot',
                'point_type': 'partner_vendor',
                'address':    'To be confirmed with vendor.',
            }
        )
        receiving_vendor = best.vendor
    else:
        # ── NEW fallback: no vendor capacity available — use an admin parking lot ──
        return_point = ReturnPoint.objects.filter(
            city=return_city, point_type='parking', is_active=True,
        ).first()
        if not return_point:
            return None  # nothing available at all — admin should manually match
        receiving_vendor = None  # parking lots have no receiving vendor to pay

    from datetime import timedelta
    inspection_due = timezone.now() + timedelta(hours=24)

    handover = HandoverRecord.objects.create(
        booking                = booking,
        return_point           = return_point,
        receiving_vendor       = receiving_vendor,
        status                 = 'EXPECTED',
        full_inspection_due_by = inspection_due,
        deposit_hold_extended  = True,
    )

    if best:
        _calculate_revenue_share(booking, best)

    return handover
 
 
class AdminManualMatchView(APIView):
    """
    POST /api/logistics/admin/manual-match/
    Admin manually assigns a partner vendor when auto-match found nothing.
    Body: { "booking_id": ..., "return_point_id": ..., "vendor_id": ... }
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request):
        booking_id      = request.data.get("booking_id")
        return_point_id = request.data.get("return_point_id")
        vendor_id       = request.data.get("vendor_id")
 
        booking      = get_object_or_404(Booking, pk=booking_id)
        return_point = get_object_or_404(ReturnPoint, pk=return_point_id)
 
        from django.contrib.auth import get_user_model
        User = get_user_model()
        receiving_vendor = get_object_or_404(User, pk=vendor_id) if vendor_id else None
 
        from datetime import timedelta
        handover, created = HandoverRecord.objects.update_or_create(
            booking=booking,
            defaults={
                'return_point':           return_point,
                'receiving_vendor':       receiving_vendor,
                'status':                 'EXPECTED',
                'full_inspection_due_by': timezone.now() + timedelta(hours=24),
                'deposit_hold_extended':  True,
            }
        )
        return Response({'message': 'Handover assigned.', 'handover_id': handover.id})


class HandoverConfirmView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/confirm/
    Receiving vendor confirms vehicle has been received.
    Body: { "notes": "..." }
    This starts the 24-hour full inspection window.
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(
            HandoverRecord,
            pk               = handover_id,
            receiving_vendor = request.user,
        )
        if handover.status != 'EXPECTED':
            return Response({'error': 'Handover already confirmed.'}, status=400)
 
        handover.status               = "RECEIVED"
        handover.handover_notes       = request.data.get("notes", "")
        handover.handover_confirmed_at = timezone.now()
        handover.save()
 
        # Notify originating vendor
        from django.core.mail import send_mail
        try:
            send_mail(
                subject    = f'[CarRent India] Vehicle Received at {handover.return_point.name}',
                message    = (
                    f'Your vehicle {handover.booking.vehicle.plate_number} from booking '
                    f'{handover.booking.booking_ref} has been received at '
                    f'{handover.return_point.name} in {handover.return_point.city.name}.'
                ),
                from_email     = 'noreply@carrentindia.com',
                recipient_list = [handover.booking.vendor.email],
                fail_silently  = True,
            )
        except Exception:
            pass
 
        return Response({'message': 'Vehicle receipt confirmed. 24-hour inspection window started.'})
 
 
class HandoverPhotoUploadView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/photos/
    Parking partner or receiving vendor uploads walk-round photos.
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(HandoverRecord, pk=handover_id)
 
        # Allow receiving vendor or any vendor (parking staff scenario)
        if (handover.receiving_vendor and
                request.user != handover.receiving_vendor and
                request.user.role != 'admin'):
            return Response({'error': 'Not authorised.'}, status=403)
 
        image = request.FILES.get("image")
        if not image:
            return Response({'error': 'image is required.'}, status=400)
 
        photo = HandoverPhoto.objects.create(handover=handover, image=image)
        handover.handover_photos_uploaded = True
        handover.save(update_fields=["handover_photos_uploaded"])
        return Response({'photo_id': photo.id}, status=201)
 
 
class HandoverInspectionCompleteView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/inspection-complete/
    Marks the full inspection as done and vehicle as HELD, ready for retrieval.
    Called by receiving vendor after conducting the detailed inspection.
    """
    permission_classes = [IsVendorRole]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(
            HandoverRecord, pk=handover_id, receiving_vendor=request.user,
        )
        handover.status               = 'HELD'
        handover.full_inspection_done = True
        handover.save()

        # ── NEW: vehicle has physically arrived — update its searchable location ──
        vehicle = handover.booking.vehicle
        vehicle.current_city = handover.return_point.city
        vehicle.save(update_fields=['current_city'])

        booking = handover.booking
        if not handover.booking.deposit_released:
            booking.deposit_released = True
            booking.save(update_fields=["deposit_released"])

        return Response({'message': 'Full inspection complete. Vehicle marked as HELD.'})
 
 
class HandoverRetrievalArrangedView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/retrieval/
    Originating vendor or admin marks retrieval as arranged.
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(HandoverRecord, pk=handover_id)
        if (request.user != handover.booking.vendor and
                request.user.role != 'admin'):
            return Response({'error': 'Not authorised.'}, status=403)
        handover.status               = 'RETRIEVED'
        handover.retrieval_arranged_at = timezone.now()
        handover.retrieved_at          = timezone.now()
        handover.save()
        return Response({'message': 'Vehicle marked as retrieved.'})


def _calculate_revenue_share(booking, network_member: VendorNetwork) -> RevenueShare:
    """
    Revenue split for a cross-city (one-way) booking.

    The parking/handling amount is now ENTIRELY admin-controlled:
      - CityParkingRate.amount = the fixed price for parking in this city,
        same for every vendor — vendors cannot set or change it.
      - VendorCommissionOverride (if present for this vendor+city) or the
        platform-wide default (parking_default_vendor_share_pct) decides
        what % of that fixed amount the receiving vendor keeps. The rest
        is the platform's cut of the parking transaction, on top of the
        platform's normal rental commission.
    """
    total = booking.total_amount
    city  = network_member.city

    platform_pct = get_config('platform_commission', Decimal('0.18'))

    try:
        city_rate = city.parking_rate
        handling_fee_gross = city_rate.amount if city_rate.is_active else Decimal(str(
            get_config('cross_city_handling_fee_min', Decimal('300'))))
    except CityParkingRate.DoesNotExist:
        handling_fee_gross = Decimal(str(get_config('cross_city_handling_fee_min', Decimal('300'))))

    override = VendorCommissionOverride.objects.filter(
        vendor=network_member.vendor, city=city, is_active=True).first()
    vendor_share_pct = (
        override.vendor_share_pct if override
        else Decimal(str(get_config('parking_default_vendor_share_pct', Decimal('70'))))
    )

    receiving_vendor_net = (handling_fee_gross * vendor_share_pct / 100).quantize(Decimal('0.01'))
    platform_parking_cut = handling_fee_gross - receiving_vendor_net

    platform_rental_amt = total * platform_pct
    platform_amt         = platform_rental_amt + platform_parking_cut
    originating_amt      = total - platform_amt - handling_fee_gross

    sublisting_pct = get_config('cross_city_partner_sublisting_pct', Decimal('0.05'))

    rev_share, _ = RevenueShare.objects.update_or_create(
        booking=booking,
        defaults={
            'total_revenue':          total,
            'originating_vendor_pct': (originating_amt / total * 100).quantize(Decimal('0.01')),
            'originating_vendor_amt': originating_amt,
            'platform_pct':           (platform_amt / total * 100).quantize(Decimal('0.01')),
            'platform_amt':           platform_amt,
            'partner_handling_fee':   receiving_vendor_net,
            'partner_sublisting_pct': sublisting_pct * 100,
            'partner_sublisting_amt': Decimal('0'),
        }
    )
    return rev_share
 
 
class RevenueShareDetailView(generics.RetrieveAPIView):
    """GET /api/logistics/revenue-share/{booking_id}/ — get revenue split for a booking"""
    serializer_class   = RevenueShareSerializer
    permission_classes = [permissions.IsAuthenticated]
 
    def get_object(self):
        booking = get_object_or_404(Booking, pk=self.kwargs["booking_id"])
        # Only originating vendor, receiving vendor, or admin can see this
        user = self.request.user
        if (user != booking.vendor and
                user.role != 'admin' and
                not HandoverRecord.objects.filter(
                    booking=booking, receiving_vendor=user).exists()):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied
        return get_object_or_404(RevenueShare, booking=booking)


class ParkingPartnerConfirmView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/parking-confirm/
    Used by parking lot staff who are NOT on the platform as vendors.
    They confirm receipt and upload photos using a shared access token
    (admin provides a one-time link — simplified for Phase 4).
 
    In production: replace with a QR-code-scanned parking staff link.
    In dev: admin can call this endpoint directly.
    """
    permission_classes = [IsAdminRole]   # Admin acts on behalf of parking staff in Phase 4
    parser_classes     = [MultiPartParser, FormParser]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(HandoverRecord, pk=handover_id)
        handover.status               = 'RECEIVED'
        handover.handover_notes       = request.data.get("notes", "Received by parking partner.")
        handover.handover_confirmed_at = timezone.now()
        handover.deposit_hold_extended = True
        handover.save()

        # ── Mark the vehicle as now physically at this parking lot's city ──
        vehicle = handover.booking.vehicle
        vehicle.current_city = handover.return_point.city
        vehicle.save(update_fields=['current_city'])
 
        # Upload photos if provided
        for img in request.FILES.getlist("photos"):
            HandoverPhoto.objects.create(handover=handover, image=img)
 
        # Notify originating vendor: 24h to inspect
        from datetime import timedelta
        handover.full_inspection_due_by = timezone.now() + timedelta(hours=24)
        handover.save(update_fields=["full_inspection_due_by"])
 
        from django.core.mail import send_mail
        try:
            send_mail(
                subject = f'[CarRent India] Vehicle at Parking — Inspection Required',
                message = (
                    f'Your vehicle {handover.booking.vehicle.plate_number} has been received '
                    f'at {handover.return_point.name}. Please complete a full inspection '
                    f'within 24 hours (by {handover.full_inspection_due_by.strftime("%d %b %Y %H:%M")} IST).'
                ),
                from_email     = 'noreply@carrentindia.com',
                recipient_list = [handover.booking.vendor.email],
                fail_silently  = True,
            )
        except Exception:
            pass
 
        return Response({'message': 'Parking partner confirmed receipt. 24h inspection window started.'})


class GrantSublistPermissionView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/grant-sublist/
    Originating vendor grants permission for receiving vendor to sub-list.
    """
    permission_classes = [IsVendorRole]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(
            HandoverRecord, pk=handover_id, booking__vendor=request.user,
        )
        if handover.status not in ['HELD', 'INSPECTED']:
            return Response({'error': 'Vehicle must be HELD before sub-listing can be granted.'}, status=400)

        handover.status = 'SUBLISTED'
        handover.save()

        vehicle = handover.booking.vehicle
        vehicle.status = 'LIVE'
        vehicle.current_city = handover.return_point.city   # ← NEW, safety net
        vehicle.save(update_fields=["status", "current_city"])

        return Response({'message': 'Sub-listing permission granted. Vehicle is now LIVE in the return city.'})
 
 
class RevokeSublistPermissionView(APIView):
    """
    POST /api/logistics/handovers/{handover_id}/revoke-sublist/
    Originating vendor revokes sub-listing permission.
    """
    permission_classes = [IsVendorRole]
 
    def post(self, request, handover_id):
        handover = get_object_or_404(
            HandoverRecord,
            pk              = handover_id,
            booking__vendor = request.user,
        )
        if handover.status == 'SUBLISTED':
            handover.status = 'HELD'
            handover.save()
            vehicle = handover.booking.vehicle
            vehicle.status = 'INACTIVE'
            vehicle.save(update_fields=["status"])
        return Response({'message': 'Sub-listing revoked.'})


class AdminLogisticsOverviewView(generics.ListAPIView):
    """
    GET /api/logistics/admin/overview/
    Returns all active handover records with vehicle, location,
    status, and days held information.
    Used to populate the admin logistics map and list view.
    """
    serializer_class   = HandoverRecordSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        qs = HandoverRecord.objects.select_related(
            'booking__vehicle',
            'booking__vendor__vendor_profile',
            'booking__customer',
            'return_point__city',
            'receiving_vendor__vendor_profile',
        ).prefetch_related("photos")
 
        # Exclude fully retrieved handovers unless requested
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.exclude(status='RETRIEVED')
 
        city_filter = self.request.query_params.get('city')
        if city_filter:
            qs = qs.filter(return_point__city_id=city_filter)
 
        return qs
 
 
class AdminLogisticsStatsView(APIView):
    """
    GET /api/logistics/admin/stats/
    Quick counts for the admin logistics dashboard card.
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        return Response({
            'expected':  HandoverRecord.objects.filter(status='EXPECTED').count(),
            'received':  HandoverRecord.objects.filter(status='RECEIVED').count(),
            'held':      HandoverRecord.objects.filter(status='HELD').count(),
            'sublisted': HandoverRecord.objects.filter(status='SUBLISTED').count(),
            'network_vendors': VendorNetwork.objects.filter(is_active=True).count(),
            'return_points':   ReturnPoint.objects.filter(is_active=True).count(),
        })
 
 
class PartnerVendorHandoverListView(generics.ListAPIView):
    """
    GET /api/logistics/my-held/
    Vendor sees all vehicles currently held at their location.
    Includes vehicles that are RECEIVED, INSPECTED, HELD, or SUBLISTED.
    """
    serializer_class   = HandoverRecordSerializer
    permission_classes = [IsVendorRole]
 
    def get_queryset(self):
        return HandoverRecord.objects.filter(
            receiving_vendor = self.request.user,
            status__in       = ['RECEIVED', 'INSPECTED', 'HELD', 'SUBLISTED'],
        ).select_related(
            'booking__vehicle',
            'booking__vendor__vendor_profile',
            'return_point',
        ).prefetch_related("photos")


class AdminCityParkingRateViewSet(viewsets.ModelViewSet):
    """
    GET    /api/logistics/admin/parking-rates/          — list all city rates
    POST   /api/logistics/admin/parking-rates/          — set a new city's rate
    PATCH  /api/logistics/admin/parking-rates/{id}/      — change the rate
    DELETE /api/logistics/admin/parking-rates/{id}/      — remove (city has no fixed rate)
    """
    queryset           = CityParkingRate.objects.select_related('city').all()
    serializer_class   = CityParkingRateSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class AdminVendorCommissionOverrideViewSet(viewsets.ModelViewSet):
    """
    GET    /api/logistics/admin/vendor-commissions/                — list all overrides
    GET    /api/logistics/admin/vendor-commissions/?city=2          — filter by city
    GET    /api/logistics/admin/vendor-commissions/?vendor=5        — filter by vendor
    POST   /api/logistics/admin/vendor-commissions/                — set a vendor-specific split
    PATCH  /api/logistics/admin/vendor-commissions/{id}/            — change it
    DELETE /api/logistics/admin/vendor-commissions/{id}/            — revert vendor to platform default
    """
    serializer_class   = VendorCommissionOverrideSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = VendorCommissionOverride.objects.select_related(
            'vendor__vendor_profile', 'city').all()
        city   = self.request.query_params.get('city')
        vendor = self.request.query_params.get('vendor')
        if city:   qs = qs.filter(city_id=city)
        if vendor: qs = qs.filter(vendor_id=vendor)
        return qs

    def perform_create(self, serializer):
        serializer.save(set_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(set_by=self.request.user)