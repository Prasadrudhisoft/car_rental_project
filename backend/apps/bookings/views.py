import hmac, hashlib, json
from datetime import datetime, timezone
from decimal import Decimal
import razorpay
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone as dj_timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
 
from apps.configuration.utils import get_config, get_segment_config
from apps.vehicles.models import Vehicle, VehicleAvailability
 
from .models import Booking, AddOn, InspectionRecord, InspectionPhoto, Invoice, PaymentEvent
from .pricing import calculate_price, get_addon_price
from .serializers import (
    BookingDetailSerializer, BookingListSerializer,
    InspectionRecordSerializer, InspectionPhotoSerializer, InvoiceSerializer,
)
from apps.logistics.capacity import ReturnCapacityConflict, validate_return_location, release_return_slot
import logging
from django.core.cache import cache
from django.db import transaction, IntegrityError
from django.db.models import F, Count
from rest_framework.throttling import ScopedRateThrottle
from car_rent.async_utils import enqueue
from apps.personalization.tasks import run_event_rules_task
from . import tasks as booking_tasks
import datetime
from decimal import InvalidOperation
from apps.promotions.service import PromoError, redeem_promo
from .pricing import build_quote, one_way_fee_for
from .payments import PaymentService, PaymentError, payment_schedule
 

logger = logging.getLogger(__name__)
# ── Role permission helpers ──────────────────────────────────────────────
class IsCustomerRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'customer'
 
class IsVendorRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'vendor'
 
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'admin'

 
# ════════════════════════════════════════════════════════════════════════
# PRICING PREVIEW (called on each step change in booking wizard)
# ════════════════════════════════════════════════════════════════════════
 
def _pickup_city_id(vehicle):
    loc = vehicle.pickup_location or getattr(getattr(vehicle.vendor, 'vendor_profile', None), 'pickup_location', None)
    return loc.city_id if loc else vehicle.city_id


class PricePreviewView(APIView):
    """
    POST /api/bookings/price-preview/
    Body: { vehicle_id, pickup_date, return_date, pickup_time?, return_time?, addons?,
            return_city_id?, promo_code? }
    The ONLY pricing the UI shows. one_way_fee is computed here, any client value is ignored.
    A bad promo does not fail the call: the quote comes back undiscounted with `promo_error`.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if request.user.is_authenticated and getattr(request.user, 'role', None) != 'customer':
            return Response({'error': 'Bookings are available to customer accounts only.'}, status=403)

        d = request.data
        if not all([d.get('vehicle_id'), d.get('pickup_date'), d.get('return_date')]):
            return Response({'error': 'vehicle_id, pickup_date, return_date required.'}, status=400)
        vehicle = get_object_or_404(Vehicle, pk=d['vehicle_id'], status="LIVE")
        try:
            p_date = datetime.date.fromisoformat(d['pickup_date'])
            r_date = datetime.date.fromisoformat(d['return_date'])
        except (TypeError, ValueError):
            return Response({'error': 'Invalid date.'}, status=400)
        days = (r_date - p_date).days
        if days < 0:
            return Response({'error': 'Return date cannot be before pickup date.'}, status=400)

        fee = one_way_fee_for(_pickup_city_id(vehicle), d.get('return_city_id') or None)
        quote, promo_error = build_quote(
            vehicle, p_date, r_date, d.get('addons', []), fee,
            d.get('pickup_time'), d.get('return_time'), d.get('promo_code'), request.user)

        date_range = [p_date + datetime.timedelta(days=i) for i in range(days + 1)]
        quote['available']   = not VehicleAvailability.objects.filter(
            vehicle=vehicle, blocked_date__in=date_range).exists()
        quote['promo_error'] = promo_error
        try:
            prof = vehicle.vendor.vendor_profile
            quote['vendor_opening_time'] = str(prof.shop_opening_time or '')
            quote['vendor_closing_time'] = str(prof.shop_closing_time or '')
        except Exception:
            quote['vendor_opening_time'] = quote['vendor_closing_time'] = ''
        return Response(quote)

def _run(fn):
    try:
        return Response(fn())
    except PaymentError as exc:
        return Response({'error': str(exc), 'code': exc.code}, status=exc.status)


def _own_booking(request, booking_id):
    return get_object_or_404(Booking, pk=booking_id, customer=request.user)


class PaymentConfigView(APIView):
    """GET /api/bookings/payments/config/ -> { mode: dummy|razorpay|unavailable, key_id, ... }"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(PaymentService.public_config())


class PaymentInitiateView(APIView):
    """POST /api/bookings/{id}/payment/initiate/  { payment_type } -> Razorpay order"""
    permission_classes = [IsCustomerRole]

    def post(self, request, booking_id):
        booking = _own_booking(request, booking_id)
        return _run(lambda: PaymentService.initiate(booking, request.data.get('payment_type', 'advance')))


class PaymentVerifyView(APIView):
    """POST /api/bookings/{id}/payment/verify/  { razorpay_order_id, razorpay_payment_id, razorpay_signature }"""
    permission_classes = [IsCustomerRole]

    def post(self, request, booking_id):
        booking = _own_booking(request, booking_id)
        d = request.data
        return _run(lambda: PaymentService.verify(
            booking, d.get('razorpay_order_id'), d.get('razorpay_payment_id'), d.get('razorpay_signature')))


class DummyPaymentView(APIView):
    """DEV ONLY. 404 unless PaymentService.dummy_enabled()."""
    permission_classes = [IsCustomerRole]

    def post(self, request, booking_id):
        booking = _own_booking(request, booking_id)
        return _run(lambda: PaymentService.pay_dummy(booking, request.data.get('payment_type', 'advance')))


class PaymentOfflineView(APIView):
    """POST /api/bookings/{id}/payment/record-offline/ { method: cash|upi } — vendor/admin, balance only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        return _run(lambda: PaymentService.record_offline(booking, request.user, request.data.get('method')))


class RazorpayWebhookView(APIView):
    """POST /api/bookings/webhook/razorpay/ — signed with RAZORPAY_WEBHOOK_SECRET."""
    permission_classes     = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes       = []

    def post(self, request):
        return _run(lambda: PaymentService.handle_webhook(
            request.body, request.headers.get('X-Razorpay-Signature', ''),
            request.headers.get('X-Razorpay-Event-Id', '')))
 
# ════════════════════════════════════════════════════════════════════════
# BOOKING CREATION
# ════════════════════════════════════════════════════════════════════════
 
class BookingCreateView(APIView):
    """
    POST /api/bookings/create/
    Creates a booking in PENDING status.
    Payment must be completed separately.
    """
    permission_classes = [IsCustomerRole]

    def post(self, request):
        from apps.notifications.utils import notify

        vehicle_id     = request.data.get('vehicle_id')
        pickup_date_s  = request.data.get('pickup_date')
        return_date_s  = request.data.get('return_date')
        pickup_time_s  = request.data.get('pickup_time')   # "HH:MM" or None
        return_time_s  = request.data.get('return_time')   # "HH:MM" or None
        pickup_loc_id  = request.data.get('pickup_location')   # fallback only; server resolves from vehicle
        return_loc_id  = request.data.get('return_location')
        addons         = request.data.get('addons', [])

        if not all([vehicle_id, pickup_date_s, return_date_s]):
            return Response(
                {'error': 'vehicle_id, pickup_date, return_date required.'},
                status=400
            )

        # ── Rental agreement must be accepted before payment ──────────────
        from apps.agreements.models import AgreementVersion, AgreementAcceptance
        from apps.agreements.views import _get_client_ip, _get_user_agent

        active_version = AgreementVersion.get_active()
        if not active_version:
            return Response(
                {'error': 'No active rental agreement found. Contact support.'},
                status=503
            )

        if request.data.get('agreement_accepted') not in (True, 'true', 'True', 1, '1'):
            return Response(
                {'error': 'You must accept the Rental Agreement to continue.'},
                status=400
            )

        if str(request.data.get('agreement_version_id')) != str(active_version.id):
            return Response({
                'error': 'The Rental Agreement was updated. Please review the latest version and accept again.',
                'code': 'agreement_outdated',
            }, status=409)

        vehicle = get_object_or_404(Vehicle, pk=vehicle_id, status="LIVE")
        p_date = datetime.date.fromisoformat(pickup_date_s)
        r_date = datetime.date.fromisoformat(return_date_s)
        days = (r_date - p_date).days

        seg_cfg = get_segment_config(vehicle.segment)
        min_rental_days = seg_cfg.get('min_rental_days', 1)
        min_driver_age = seg_cfg.get('min_driver_age', 21)

        effective_days = max(days, 1)
        if effective_days < min_rental_days:
            return Response({
                'error': (
                    f'{vehicle.get_segment_display()} vehicles require a minimum rental of '
                    f'{min_rental_days} day{"s" if min_rental_days != 1 else ""}. '
                    f'Please select a longer rental period.'
                )
            }, status=400)

        dob = getattr(
            getattr(request.user, 'customer_profile', None),
            'date_of_birth',
            None
        )
        if dob:
            today = datetime.date.today()
            age = today.year - dob.year - (
                (today.month, today.day) < (dob.month, dob.day)
            )
            if age < min_driver_age:
                return Response({
                    'error': (
                        f'You must be at least {min_driver_age} years old to rent this '
                        f'{vehicle.get_segment_display()}. Please update your date of birth in your '
                        f'profile if this is incorrect.'
                    )
                }, status=400)

        if days < 0:
            return Response(
                {'error': 'Return date cannot be before pickup date.'},
                status=400
            )

        # Validate times against vendor shop hours
        if pickup_time_s or return_time_s:
            try:
                opening = vehicle.vendor.vendor_profile.shop_opening_time
                closing = vehicle.vendor.vendor_profile.shop_closing_time

                if opening and closing:

                    def is_within_vendor_hours(check_time):
                        # Normal hours, e.g. 10:00 → 22:00
                        if opening <= closing:
                            return opening <= check_time <= closing

                        # Overnight hours, e.g. 10:00 → 05:00
                        return check_time >= opening or check_time <= closing

                    if pickup_time_s:
                        pt = datetime.time(
                            *[int(x) for x in pickup_time_s.split(':')]
                        )

                        if not is_within_vendor_hours(pt):
                            print(
                                f'DEBUG Pickup time {pt} outside vendor hours '
                                f'{opening}-{closing}'
                            )
                            return Response({
                                'error': (
                                    f'Pickup time must be between '
                                    f'{opening.strftime("%H:%M")} and '
                                    f'{closing.strftime("%H:%M")}.'
                                )
                            }, status=400)

                    if return_time_s:
                        rt = datetime.time(
                            *[int(x) for x in return_time_s.split(':')]
                        )

                        if not is_within_vendor_hours(rt):
                            print(
                                f'DEBUG Return time {rt} outside vendor hours '
                                f'{opening}-{closing}'
                            )
                            return Response({
                                'error': (
                                    f'Return time must be between '
                                    f'{opening.strftime("%H:%M")} and '
                                    f'{closing.strftime("%H:%M")}.'
                                )
                            }, status=400)

            except Exception:
                pass

        # Check date availability — reject if any date in range is blocked
        date_range = [
            p_date + datetime.timedelta(days=i)
            for i in range(days + 1)
        ]
        conflicts = VehicleAvailability.objects.filter(
            vehicle=vehicle,
            blocked_date__in=date_range
        ).count()

        if conflicts:
            return Response(
                {'error': 'Vehicle is not available for the selected dates.'},
                status=409
            )

        # Parse time strings to time objects for storage
        def parse_time(t):
            if not t:
                return None
            try:
                return datetime.time(*[int(x) for x in t.split(':')])
            except:
                return None

        # Resolve locations server-side (never trust a client-sent id for the pickup)
        from apps.locations.models import Location
        from django.db import transaction

        pickup_location = (
            vehicle.pickup_location
            or getattr(
                getattr(vehicle.vendor, 'vendor_profile', None),
                'pickup_location',
                None
            )
            or (
                get_object_or_404(Location, pk=pickup_loc_id)
                if pickup_loc_id else None
            )
        )

        if pickup_location is None:
            return Response(
                {'error': 'This vehicle has no pickup location configured.'},
                status=400
            )

        return_location = (
            get_object_or_404(Location, pk=return_loc_id)
            if return_loc_id else None
        )

        if return_location and return_location.id != pickup_location.id:
            err = validate_return_location(return_location, vehicle.vendor_id)
            if err:
                return Response({'error': err}, status=409)

        # Calculate price using server-side fees and promo validation
        raw_promo = (request.data.get('promo_code') or '').strip().upper()
        breakdown, promo_error = build_quote(
            vehicle,
            p_date,
            r_date,
            addons,
            one_way_fee_for(
                pickup_location.city_id,
                return_location.city_id if return_location else None
            ),
            pickup_time_s,
            return_time_s,
            raw_promo,
            request.user
        )

        if promo_error:  # never silently charge a different price
            return Response({
                'error': promo_error,
                'code': 'promo_invalid'
            }, status=400)

        try:
            with transaction.atomic():
                booking = Booking.objects.create(
                    customer=request.user,
                    vehicle=vehicle,
                    vendor=vehicle.vendor,
                    pickup_date=p_date,
                    pickup_time=parse_time(pickup_time_s),
                    return_date=r_date,
                    return_time=parse_time(return_time_s),
                    pickup_location=pickup_location,
                    return_location=return_location,
                    is_one_way=bool(
                        return_location
                        and return_location.id != pickup_location.id
                    ),
                    pricing_snapshot=breakdown,
                    total_amount=Decimal(breakdown['grand_total']),
                    deposit_amount=Decimal(breakdown['security_deposit']),
                    agreement_signed=True,
                    agreement_signed_at=dj_timezone.now(),
                )

                for addon_type in breakdown['selected_addons']:
                    AddOn.objects.create(
                        booking=booking,
                        addon_type=addon_type,
                        price=get_addon_price(addon_type),
                    )

                if breakdown.get('promo_code'):
                    redeem_promo(
                        breakdown['promo_code'],
                        request.user,
                        booking,
                        Decimal(breakdown['subtotal']),
                        Decimal(breakdown['discount_amount'])
                    )

                AgreementAcceptance.objects.create(
                    user=request.user,
                    agreement_version=active_version,
                    booking=booking,
                    ip_address=_get_client_ip(request),
                    user_agent=_get_user_agent(request),
                    otp_verified=False,
                    acceptance_method='checkbox',
                )

        except PromoError as exc:
            return Response({
                'error': str(exc),
                'code': 'promo_invalid'
            }, status=400)

        notify(
            booking.vendor,
            title="New booking received",
            message=(
                f"{request.user.full_name} booked your {vehicle.year} "
                f"{vehicle.make} {vehicle.model} from {p_date} to {r_date}."
            ),
            notification_type='booking_created',
            link_url=f'/vendor?tab=bookings&highlight={booking.id}',
        )

        enqueue(run_event_rules_task, request.user.id, 'payment_pending')

        return Response({
            'booking_id': booking.id,
            'booking_ref': booking.booking_ref,
            'pricing': breakdown,
        }, status=201)

# ════════════════════════════════════════════════════════════════════════
# CANCELLATION
# ════════════════════════════════════════════════════════════════════════
 
class BookingCancelView(APIView):
    """POST /api/bookings/{booking_id}/cancel/ — row-locked so double-clicks can't double-refund."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        with transaction.atomic():
            booking = get_object_or_404(Booking.objects.select_for_update(), pk=booking_id)

            if request.user != booking.customer and request.user.role != "admin":
                return Response({'error': 'Not authorised.'}, status=403)
            if booking.status not in ['PENDING', 'CONFIRMED']:
                return Response({'error': 'Cannot cancel a booking that is ACTIVE, COMPLETED or already CANCELLED.'}, status=400)

            refund = _calculate_cancellation_refund(booking)

            booking.status              = 'CANCELLED'
            booking.cancellation_reason = request.data.get('reason', '')
            booking.cancelled_by        = request.user
            booking.save(update_fields=['status', 'cancellation_reason', 'cancelled_by', 'updated_at'])

            VehicleAvailability.objects.filter(
                vehicle=booking.vehicle, reason='booking', booking_ref=booking.booking_ref,
            ).delete()
            release_return_slot(booking)

            if booking.payment_captured and refund["refund_amount"] > 0:
                enqueue(booking_tasks.issue_razorpay_refund, booking.id, str(refund["refund_amount"]))
            enqueue(run_event_rules_task, booking.customer_id, 'booking_cancelled')

        return Response({
            'message':       f'Booking {booking.booking_ref} cancelled.',
            'refund_policy': refund['policy'],
            'refund_amount': str(refund['refund_amount']),
        })
 
 
def _calculate_cancellation_refund(booking) -> dict:
    """
    Read cancellation windows from config and determine refund amount.
    This is the ONLY place cancellation rules live — never hardcoded.
    """
    free_hours = get_config('cancellation_free_hours', 48)
    half_hours = get_config('cancellation_half_refund_hours', 24)
 
    pickup_dt      = datetime.datetime.combine(booking.pickup_date,
                         datetime.time.min, tzinfo=timezone.utc)
    hours_to_pickup = (pickup_dt - datetime.datetime.now(timezone.utc)).total_seconds() / 3600
 
    total = PaymentService.amount_paid(booking)
    if hours_to_pickup >= free_hours:
        return {
            'refund_amount': total,
            'policy': f'Full refund (cancelled more than {free_hours}h before pickup)',
        }
    elif hours_to_pickup >= half_hours:
        return {
            'refund_amount': (total / 2).quantize(Decimal('0.01')),
            'policy': f'50% refund (cancelled {half_hours}–{free_hours}h before pickup)',
        }
    else:
        return {
            'refund_amount': Decimal('0'),
            'policy': f'No refund (cancelled within {half_hours}h of pickup)',
        }

class OneWayFeeView(APIView):
    """
    GET /api/bookings/one-way-fee/?from_city=1&to_city=2
    Returns the logistics fee for a cross-city return.
    Frontend calls this when return city != pickup city.
    """
    permission_classes = [permissions.AllowAny]
 
    def get(self, request):
        from apps.locations.models import CityPairFee
        from_city = request.query_params.get('from_city')
        to_city   = request.query_params.get('to_city')
 
        if not from_city or not to_city:
            return Response({'error': 'from_city and to_city are required.'}, status=400)
 
        if from_city == to_city:
            return Response({'fee': '0', 'is_one_way': False})
 
        try:
            pair = CityPairFee.objects.get(
                from_city_id=from_city, to_city_id=to_city, is_active=True)
            return Response({'fee': str(pair.fee), 'is_one_way': True})
        except CityPairFee.DoesNotExist:
            return Response({'fee': '0', 'is_one_way': True,
                             'note': 'No set fee for this route. Admin will confirm.'})
 
 
class CustomerBookingListView(generics.ListAPIView):
    """GET /api/bookings/my/ — customer sees their own bookings"""
    serializer_class   = BookingListSerializer
    permission_classes = [IsCustomerRole]
 
    def get_queryset(self):
        qs = Booking.objects.filter(
            customer=self.request.user
        ).select_related("vehicle", "pickup_location", "return_location").prefetch_related("addons")
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st else qs
 
 
class CustomerBookingDetailView(generics.RetrieveAPIView):
    """GET /api/bookings/my/{booking_id}/ — full booking detail"""
    serializer_class   = BookingDetailSerializer
    permission_classes = [IsCustomerRole]
 
    def get_queryset(self):
        return Booking.objects.filter(customer=self.request.user).select_related(
        'vehicle', 'vendor__vendor_profile', 'customer',
        'pickup_location__city', 'return_location__city',
        ).prefetch_related('addons', 'inspections__photos', 'invoice',
                       'agreement_acceptances__agreement_version')
 
 
class VendorBookingListView(generics.ListAPIView):
    """GET /api/bookings/vendor/ — vendor sees bookings for their vehicles"""
    serializer_class   = BookingListSerializer
    permission_classes = [IsVendorRole]
 
    def get_queryset(self):
        qs = Booking.objects.filter(
            vendor=self.request.user
        ).prefetch_related("customer", "vehicle", "pickup_location", "return_location",'vendor__vendor_profile', 'pickup_location__city', 'return_location__city','agreement_acceptances__agreement_version')
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st else qs
 
 
class AdminBookingListView(generics.ListAPIView):
    """GET /api/bookings/admin/ — admin sees all bookings"""
    serializer_class   = BookingDetailSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        return Booking.objects.select_related(
        'customer', 'vehicle', 'vendor__vendor_profile',
        'pickup_location__city', 'return_location__city',
        ).prefetch_related('addons', 'inspections__photos', 'invoice',
                       'agreement_acceptances__agreement_version')



class InspectionCreateView(APIView):
    """
    POST /api/bookings/{booking_id}/inspect/pickup/
    POST /api/bookings/{booking_id}/inspect/return/
 
    Creates or updates the inspection record for pickup or return.
    Photos are uploaded separately via InspectionPhotoUploadView.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes     = [__import__("rest_framework.parsers", fromlist=["MultiPartParser"]).MultiPartParser,
                          __import__("rest_framework.parsers", fromlist=["FormParser"]).FormParser,
                          __import__("rest_framework.parsers", fromlist=["JSONParser"]).JSONParser]
 
    def post(self, request, booking_id, inspection_type):
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        booking = get_object_or_404(Booking, pk=booking_id)
 
        # Permission: customer or vendor of this booking
        if request.user not in [booking.customer, booking.vendor]:
            return Response({'error': 'Not authorised.'}, status=403)
 
        insp_type = inspection_type.upper()
        if insp_type not in ['PICKUP', 'RETURN']:
            return Response({'error': 'inspection_type must be pickup or return.'}, status=400)
 
        record, _ = InspectionRecord.objects.get_or_create(
            booking=booking, inspection_type=insp_type,
            defaults={
                'odometer_reading': int(request.data.get("odometer_reading", 0) or 0),
                'fuel_level':       request.data.get("fuel_level", ""),
                'notes':            request.data.get("notes", ""),
            },
        )
 
        if record.is_locked:
            return Response({'error': 'Inspection is already locked and cannot be modified.'}, status=400)
 
        record.odometer_reading = int(request.data.get("odometer_reading", record.odometer_reading))
        record.fuel_level       = request.data.get("fuel_level", record.fuel_level)
        record.notes            = request.data.get("notes", record.notes)
 
        checklist_data = request.data.get("checklist")
        if checklist_data:
            import json
            try:
                record.checklist = json.loads(checklist_data) if isinstance(checklist_data, str) else checklist_data
            except Exception:
                pass
 
        if insp_type == 'RETURN':
            damage_reported = request.data.get("damage_reported", False)

            if isinstance(damage_reported, str):
                damage_reported = damage_reported.strip().lower() in ["true", "1", "yes"]

            record.damage_reported = bool(damage_reported)
            record.damage_notes = request.data.get("damage_notes", "")

            if record.damage_reported and request.data.get("damage_amount"):
                record.damage_amount = Decimal(str(request.data["damage_amount"]))
 
        record.save()
        return Response({'inspection_id': record.id, 'status': 'saved'})
 
 
class InspectionPhotoUploadView(APIView):
    """POST /api/bookings/inspections/{inspection_id}/photos/"""
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request, inspection_id):
        from rest_framework.parsers import MultiPartParser
        record = get_object_or_404(InspectionRecord, pk=inspection_id)
        if record.is_locked:
            return Response({'error': 'Inspection is locked.'}, status=400)
        image = request.FILES.get("image")
        if not image:
            return Response({'error': 'image file is required.'}, status=400)
        photo = InspectionPhoto.objects.create(
            inspection = record,
            image      = image,
            angle      = request.data.get("angle", "other"),
        )
        return Response({'photo_id': photo.id}, status=201)
 
 
import secrets
from django.utils import timezone as dj_timezone
from datetime import timedelta
from .models import InspectionOTP


class InspectionSignView(APIView):
    """
    POST /api/bookings/{booking_id}/inspect/{inspection_type}/sign/
    PICKUP: vendor generates OTP -> customer verifies.
    RETURN: customer generates OTP -> vendor verifies.
    (Roles are now enforced server-side; previously the same person could generate AND verify.)
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'otp_verify'

    def post(self, request, booking_id, inspection_type):
        booking   = get_object_or_404(Booking, pk=booking_id)
        insp_type = inspection_type.upper()
        if insp_type not in ('PICKUP', 'RETURN'):
            return Response({'error': 'inspection_type must be pickup or return.'}, status=400)
        record = get_object_or_404(InspectionRecord, booking=booking, inspection_type=insp_type)

        step     = request.data.get('step')
        otp_code = request.data.get('otp_code')

        is_customer = request.user == booking.customer
        is_vendor   = request.user == booking.vendor
        if not (is_customer or is_vendor):
            return Response({'error': 'Not authorised.'}, status=403)

        generator_ok = is_vendor   if insp_type == 'PICKUP' else is_customer
        verifier_ok  = is_customer if insp_type == 'PICKUP' else is_vendor

        # ── generate ───────────────────────────────────────────────────────
        if step == 'generate':
            if not generator_ok:
                return Response({'error': 'You are not allowed to generate this OTP.'}, status=403)
            if record.is_locked:
                return Response({'error': 'Inspection is already locked.'}, status=400)

            generated_otp = str(secrets.randbelow(900000) + 100000)
            with transaction.atomic():
                InspectionOTP.objects.filter(inspection=record, is_used=False).delete()
                InspectionOTP.objects.create(
                    inspection=record, otp_code=generated_otp,
                    expires_at=dj_timezone.now() + timedelta(minutes=10),
                )
            return Response({
                'message':    'Share this OTP with the customer to complete pickup.' if insp_type == 'PICKUP'
                              else 'Share this OTP with the vendor to complete drop-off.',
                'otp_code':   generated_otp,
                'recipient':  'customer' if insp_type == 'PICKUP' else 'vendor',
                'expires_in': 600,
            })

        # ── verify ─────────────────────────────────────────────────────────
        if step != 'verify':
            return Response({'error': 'step must be "generate" or "verify".'}, status=400)
        if not verifier_ok:
            return Response({'error': 'You are not allowed to verify this OTP.'}, status=403)
        if not otp_code:
            return Response({'error': 'OTP code is required for verification.'}, status=400)

        with transaction.atomic():
            # Lock the rows so two simultaneous verifies can't both succeed / double-credit points.
            record  = InspectionRecord.objects.select_for_update().get(pk=record.pk)
            booking = Booking.objects.select_for_update().get(pk=booking.pk)
            if record.is_locked:
                return Response({'error': 'Inspection is already locked.'}, status=400)

            otp_record = (InspectionOTP.objects.select_for_update()
                          .filter(inspection=record, otp_code=otp_code, is_used=False).first())
            if not otp_record:
                return Response({'error': 'Invalid OTP. Please ask for a new one.'}, status=400)

            expired = dj_timezone.now() >= otp_record.expires_at
            otp_record.is_used = True
            otp_record.save(update_fields=['is_used'])
            if expired:
                return Response({'error': 'OTP has expired. Please generate a new one.'}, status=400)

            now = dj_timezone.now()
            record.customer_signed    = True
            record.customer_signed_at = record.customer_signed_at or now
            record.vendor_signed      = True
            record.vendor_signed_at   = record.vendor_signed_at or now
            record.is_locked          = True
            record.save()

            if insp_type == 'PICKUP':
                booking.status = 'ACTIVE'
            else:
                booking.status = 'COMPLETED'
                if not record.damage_reported:
                    booking.deposit_released = True
                self._credit_loyalty_points(booking)
                enqueue(booking_tasks.generate_invoice_task, booking.id)
            booking.save(update_fields=['status', 'deposit_released', 'updated_at'])

            enqueue(run_event_rules_task, booking.customer_id, 'booking_completed')

        return Response({
            'message':         f'{"Pickup" if insp_type == "PICKUP" else "Drop-off"} inspection completed!',
            'is_locked':       True,
            'customer_signed': True,
            'vendor_signed':   True,
            'booking_status':  booking.status,
        })

    @staticmethod
    def _credit_loyalty_points(booking):
        from apps.users.models import CustomerProfile
        rate   = get_config('loyalty_points_per_inr', Decimal('0.10'))
        points = int(float(booking.total_amount) * float(rate))
        if points > 0:
            # F() = atomic in the DB; the old read-modify-write lost points under concurrency
            CustomerProfile.objects.filter(user_id=booking.customer_id).update(
                loyalty_points=F('loyalty_points') + points)
 
class DamageClaimView(APIView):
    """
    POST /api/bookings/{booking_id}/damage-claim/

    Vendor raises a damage claim after return inspection.
    Admin reviews and decides how much to charge from the deposit.
    """
    permission_classes = [IsVendorRole]
 
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id, vendor=request.user)
        if booking.status != 'COMPLETED':
            return Response({'error': 'Damage claim can only be raised after return inspection.'}, status=400)
 
        return_insp = get_object_or_404(InspectionRecord,
                                         booking=booking, inspection_type="RETURN")
 
        return_insp.damage_reported = True
        return_insp.damage_notes    = request.data.get("notes", "")
        return_insp.damage_amount   = Decimal(str(request.data.get("amount", "0")))
        return_insp.save()
 
        # Keep deposit on hold
        booking.deposit_released = False
        booking.save()
 
        return Response({'message': 'Damage claim raised. Admin will review within 72 hours.'})

class LoyaltyRedemptionView(APIView):
    """
    POST /api/bookings/loyalty/redeem/
    Preview how many points will be applied and what INR discount results.
    This is called during the booking wizard before confirmation.
 
    Body: { "points_to_redeem": 200 }
    Returns: { "points": 200, "discount_inr": "50.00", "new_balance": 350 }
    """
    permission_classes = [IsCustomerRole]
 
    def post(self, request):
        points_requested = int(request.data.get("points_to_redeem", 0))
        profile  = request.user.customer_profile
        balance  = profile.loyalty_points
 
        if points_requested > balance:
            return Response({'error': f'You only have {balance} points.'}, status=400)
        if points_requested < 1:
            return Response({'error': 'Enter at least 1 point.'}, status=400)
 
        point_value  = get_config('loyalty_points_inr_value', Decimal('0.25'))
        discount_inr = Decimal(str(points_requested)) * point_value
 
        return Response({
            'points':         points_requested,
            'discount_inr':   str(discount_inr),
            'new_balance':    balance - points_requested,
            'point_value':    str(point_value),
        })
 
 
class LoyaltyBalanceView(APIView):
    """GET /api/bookings/loyalty/balance/ — return current points balance."""
    permission_classes = [IsCustomerRole]
 
    def get(self, request):
        profile = request.user.customer_profile
        point_value = get_config('loyalty_points_inr_value', Decimal('0.25'))
        return Response({
            'loyalty_points':   profile.loyalty_points,
            'point_value_inr':  str(point_value),
            'total_value_inr':  str(profile.loyalty_points * point_value),
        })


 
class VendorAnalyticsView(APIView):
    """
    GET /api/bookings/analytics/vendor/
    Query params: from_date=YYYY-MM-DD, to_date=YYYY-MM-DD
 
    Returns for the logged-in vendor:
    - total_revenue: sum of all confirmed/completed booking totals
    - booking_count: number of bookings
    - avg_booking_value: average booking total
    - bookings_by_month: [{month, count, revenue}]
    - top_vehicles: [{vehicle_display, count, revenue}]
    - status_counts: {CONFIRMED: N, ACTIVE: N, COMPLETED: N, CANCELLED: N}
    """
    permission_classes = [IsVendorRole]
 
    def get(self, request):
        import datetime
        from django.db.models import Sum, Count, Avg
        from django.db.models.functions import TruncMonth
 
        from_date = request.query_params.get("from_date")
        to_date   = request.query_params.get("to_date")
        cache_key = f'analytics:vendor:{request.user.id}:{from_date}:{to_date}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
 
        qs = Booking.objects.filter(vendor=request.user)
        qs = qs.exclude(status='PENDING')
 
        if from_date:
            qs = qs.filter(pickup_date__gte=from_date)
        if to_date:
            qs = qs.filter(pickup_date__lte=to_date)
 
        totals = qs.aggregate(
            total_revenue     = Sum("total_amount"),
            booking_count     = Count("id"),
            avg_booking_value = Avg("total_amount"),
        )
 
        bookings_by_month = (
            qs.annotate(month=TruncMonth("pickup_date"))
              .values("month")
              .annotate(count=Count("id"), revenue=Sum("total_amount"))
              .order_by("month")
        )
 
        top_vehicles = (
            qs.values("vehicle__make", "vehicle__model", "vehicle__year")
              .annotate(count=Count("id"), revenue=Sum("total_amount"))
              .order_by("-revenue")[:5]
        )
 
        counts = dict(qs.order_by().values_list('status').annotate(c=Count('id')))
        status_counts = {s: counts.get(s, 0) for s in ['CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED']}
 
        data = {
            'total_revenue':      str(totals['total_revenue'] or 0),
            'booking_count':      totals['booking_count'],
            'avg_booking_value':  str(totals['avg_booking_value'] or 0),
            'bookings_by_month': [
                {
                    'month':   m['month'].strftime('%Y-%m') if m['month'] else None,
                    'count':   m['count'],
                    'revenue': str(m['revenue'] or 0),
                }
                for m in bookings_by_month
            ],
            'top_vehicles': [
                {
                    'vehicle': f"{v['vehicle__year']} {v['vehicle__make']} {v['vehicle__model']}",
                    'count':   v['count'],
                    'revenue': str(v['revenue'] or 0),
                }
                for v in top_vehicles
            ],
            'status_counts': status_counts,
        }

        cache.set(cache_key, data, 30)
        return Response(data)
 
 
class AdminAnalyticsView(APIView):
    """
    GET /api/bookings/analytics/admin/
    Platform-wide analytics. Admin only.
    Returns overall revenue, city-wise demand, vendor performance league table.
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from django.db.models import Sum, Count, Avg
        from django.db.models.functions import TruncMonth
 
        from_date = request.query_params.get("from_date")
        to_date   = request.query_params.get("to_date")
        cache_key = f'analytics:admin:{from_date}:{to_date}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
 
        qs = Booking.objects.exclude(status__in=['PENDING', 'CANCELLED'])
        if from_date:
            qs = qs.filter(pickup_date__gte=from_date)
        if to_date:
            qs = qs.filter(pickup_date__lte=to_date)
 
        totals = qs.aggregate(
            total_revenue = Sum("total_amount"),
            total_bookings = Count("id"),
        )
 
        # Platform commission share
        commission = get_config('platform_commission', Decimal('0.18'))
        total_rev  = Decimal(str(totals["total_revenue"] or 0))
        platform_revenue = total_rev * commission
 
        # City-wise demand
        city_demand = (
            qs.values("vehicle__city__name")
              .annotate(count=Count("id"), revenue=Sum("total_amount"))
              .order_by("-count")[:10]
        )
 
        # Vendor league table
        vendor_league = (
            qs.values("vendor__vendor_profile__business_name", "vendor__id")
              .annotate(count=Count("id"), revenue=Sum("total_amount"))
              .order_by("-revenue")[:10]
        )
 
        # Monthly trend
        monthly = (
            qs.annotate(month=TruncMonth("pickup_date"))
              .values("month")
              .annotate(count=Count("id"), revenue=Sum("total_amount"))
              .order_by("month")
        )
 
        data = {
            'total_revenue':     str(total_rev),
            'platform_revenue':  str(platform_revenue),
            'total_bookings':    totals['total_bookings'],
            'city_demand': [
                {
                    'city':    c['vehicle__city__name'] or 'Unknown',
                    'count':   c['count'],
                    'revenue': str(c['revenue'] or 0),
                }
                for c in city_demand
            ],
            'vendor_league': [
                {
                    'vendor_id': v['vendor__id'],
                    'name':      v['vendor__vendor_profile__business_name'] or 'Unknown',
                    'count':     v['count'],
                    'revenue':   str(v['revenue'] or 0),
                }
                for v in vendor_league
            ],
            'monthly_trend': [
                {
                    'month':   m['month'].strftime('%Y-%m') if m['month'] else None,
                    'count':   m['count'],
                    'revenue': str(m['revenue'] or 0),
                }
                for m in monthly
            ],
        }

        cache.set(cache_key, data, 30); 
        return Response(data)

class SavePushSubscriptionView(APIView):
    """
    POST /api/bookings/push/subscribe/
    Body: { endpoint, keys: { p256dh, auth } }
    Saves or updates the browser push subscription for the logged-in user.
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request):
        from .models import PushSubscription
        endpoint = request.data.get("endpoint")
        keys     = request.data.get("keys", {})
 
        if not endpoint:
            return Response({'error': 'endpoint is required.'}, status=400)
 
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user':      request.user,
                'p256dh':    keys.get('p256dh', ''),
                'auth':      keys.get('auth', ''),
                'is_active': True,
            }
        )
        return Response({'message': 'Push subscription saved.'})
 
 
class DeletePushSubscriptionView(APIView):
    """
    POST /api/bookings/push/unsubscribe/

    Body: { endpoint }
    Deactivates a push subscription (user opted out).
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request):
        from .models import PushSubscription
        endpoint = request.data.get("endpoint")
        PushSubscription.objects.filter(
            user=request.user, endpoint=endpoint).update(is_active=False)
        return Response({'message': 'Unsubscribed.'})


class VendorBookingDetailView(generics.RetrieveAPIView):
    """
    GET /api/bookings/vendor/{pk}/
    Vendor retrieves full detail for one of their bookings including
    inspections, add-ons, invoice, pricing snapshot.
    """
    serializer_class   = BookingDetailSerializer
    permission_classes = [IsVendorRole]
 
    def get_queryset(self):
        return Booking.objects.filter(vendor=self.request.user).prefetch_related(
            'addons', 'inspections__photos', 'invoice'
        ).select_related('customer', 'vehicle', 'pickup_location', 'return_location')
 