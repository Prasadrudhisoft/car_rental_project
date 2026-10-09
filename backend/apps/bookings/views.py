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

class DateConflict(Exception):
    """Another booking / manual block already holds one of the requested dates."""


def _block_vehicle_dates(booking):
    """
    Authoritative availability guard. Row-locks the vehicle so two customers paying for
    the same car/dates at the same instant are serialised: the second gets DateConflict.
    (The old get_or_create silently ignored an existing block from ANOTHER booking.)
    """
    days  = (booking.return_date - booking.pickup_date).days
    dates = [booking.pickup_date + datetime.timedelta(days=i) for i in range(days + 1)]
    with transaction.atomic():
        Vehicle.objects.select_for_update().only('id').get(pk=booking.vehicle_id)
        existing = list(VehicleAvailability.objects.filter(
            vehicle_id=booking.vehicle_id, blocked_date__in=dates))
        if any(r.booking_ref != booking.booking_ref for r in existing):
            raise DateConflict()
        have = {r.blocked_date for r in existing}
        VehicleAvailability.objects.bulk_create([
            VehicleAvailability(vehicle_id=booking.vehicle_id, blocked_date=d,
                                reason='booking', booking_ref=booking.booking_ref)
            for d in dates if d not in have
        ])


def _conflict_message(exc):
    if isinstance(exc, ReturnCapacityConflict):
        return str(exc) or 'The selected drop point is no longer available.'
    return 'This vehicle was just booked for those dates by another customer.'


def _cancel_on_conflict(booking, payment_id='', reason='Vehicle was booked by another customer before payment completed.'):
    """Lost the race (vehicle dates or drop-point slot): cancel, and refund if money was captured."""
    Booking.objects.filter(pk=booking.pk, status='PENDING').update(
        status='CANCELLED',
        cancellation_reason=reason,
        razorpay_payment_id=payment_id or booking.razorpay_payment_id,
    )
    if payment_id:
        enqueue(booking_tasks.issue_razorpay_refund, booking.id, str(booking.total_amount))


def _confirm_booking_payment(booking, payment_id=''):
    """Idempotent PENDING -> CONFIRMED. Shared by verify + webhook. Raises DateConflict."""
    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(pk=booking.pk)
        if booking.status != 'PENDING':
            return booking, False
        _block_vehicle_dates(booking)
        booking.razorpay_payment_id = payment_id or booking.razorpay_payment_id
        booking.payment_captured    = True
        booking.payment_captured_at = dj_timezone.now()
        booking.status              = 'CONFIRMED'
        booking.deposit_held        = True
        booking.save(update_fields=['razorpay_payment_id', 'payment_captured',
                                    'payment_captured_at', 'status', 'deposit_held', 'updated_at'])
        if booking.is_one_way:
            from apps.logistics.views import auto_match_return_partner
            auto_match_return_partner(booking)
        enqueue(booking_tasks.generate_agreement_pdf_task, booking.id)
        enqueue(booking_tasks.send_booking_confirmation, booking.id)
    return booking, True
 
 
# ════════════════════════════════════════════════════════════════════════
# PRICING PREVIEW (called on each step change in booking wizard)
# ════════════════════════════════════════════════════════════════════════
 
class PricePreviewView(APIView):
    """
    POST /api/bookings/price-preview/
    Called by the frontend on every step of the booking wizard to show
    the live price breakdown without creating a booking.
 
    Body: { vehicle_id, pickup_date, return_date, addons: [], one_way_fee: 0 }
    Returns: complete itemised pricing breakdown
    """
    # permission_classes = [IsCustomerRole]
    permission_classes = [permissions.AllowAny]
 
    def post(self, request):

        if request.user.is_authenticated and getattr(request.user, 'role', None) != 'customer':
            return Response({'error': 'Bookings are available to customer accounts only.'}, status=403)        
        
        vehicle_id   = request.data.get("vehicle_id")
        pickup_date  = request.data.get("pickup_date")
        return_date  = request.data.get("return_date")
        pickup_time  = request.data.get("pickup_time")   # "HH:MM" or None
        return_time  = request.data.get("return_time")   # "HH:MM" or None
        addons       = request.data.get("addons", [])
        one_way_fee  = Decimal(str(request.data.get('one_way_fee', '0')))

        if not all([vehicle_id, pickup_date, return_date]):
            return Response({'error': 'vehicle_id, pickup_date, return_date required.'}, status=400)

        vehicle = get_object_or_404(Vehicle, pk=vehicle_id, status="LIVE")
        p_date  = datetime.date.fromisoformat(pickup_date)
        r_date  = datetime.date.fromisoformat(return_date)
        days    = (r_date - p_date).days

        if days < 0:
            return Response({'error': 'Return date cannot be before pickup date.'}, status=400)

        # Also expose vendor shop hours so frontend can validate time selection
        try:
            opening = str(vehicle.vendor.vendor_profile.shop_opening_time or '')
            closing = str(vehicle.vendor.vendor_profile.shop_closing_time or '')
        except Exception:
            opening = ''
            closing = ''

        breakdown = calculate_price(
            vehicle_segment = vehicle.segment,
            daily_rate      = vehicle.daily_rate,
            rental_days     = days,
            selected_addons = addons,
            one_way_fee     = one_way_fee,
            pickup_time     = pickup_time,
            return_time     = return_time,
        )

        date_range = [p_date + datetime.timedelta(days=i) for i in range(days + 1)]
        breakdown['available'] = not VehicleAvailability.objects.filter(
            vehicle=vehicle, blocked_date__in=date_range).exists()      
          
        breakdown['vendor_opening_time'] = opening
        breakdown['vendor_closing_time'] = closing
        return Response(breakdown)
 
# ════════════════════════════════════════════════════════════════════════
# BOOKING CREATION
# ════════════════════════════════════════════════════════════════════════
 
class BookingCreateView(APIView):
    """
    POST /api/bookings/create/
    Creates a booking in PENDING status and creates a Razorpay order.
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
        one_way_fee    = Decimal(str(request.data.get('one_way_fee', '0')))

        if not all([vehicle_id, pickup_date_s, return_date_s]):
            return Response({'error': 'vehicle_id, pickup_date, return_date required.'}, status=400)

        # ── Rental agreement must be accepted before payment ──────────────
        from apps.agreements.models import AgreementVersion, AgreementAcceptance
        from apps.agreements.views import _get_client_ip, _get_user_agent
        active_version = AgreementVersion.get_active()
        if not active_version:
            return Response({'error': 'No active rental agreement found. Contact support.'}, status=503)
        if request.data.get('agreement_accepted') not in (True, 'true', 'True', 1, '1'):
            return Response({'error': 'You must accept the Rental Agreement to continue.'}, status=400)
        if str(request.data.get('agreement_version_id')) != str(active_version.id):
            return Response({
                'error': 'The Rental Agreement was updated. Please review the latest version and accept again.',
                'code':  'agreement_outdated',
            }, status=409)

        vehicle   = get_object_or_404(Vehicle, pk=vehicle_id, status="LIVE")
        p_date    = datetime.date.fromisoformat(pickup_date_s)
        r_date    = datetime.date.fromisoformat(return_date_s)
        days      = (r_date - p_date).days

        seg_cfg         = get_segment_config(vehicle.segment)
        min_rental_days = seg_cfg.get('min_rental_days', 1)
        min_driver_age  = seg_cfg.get('min_driver_age', 21)

        effective_days = max(days, 1)
        if effective_days < min_rental_days:
            return Response({
                'error': (
                    f'{vehicle.get_segment_display()} vehicles require a minimum rental of '
                    f'{min_rental_days} day{"s" if min_rental_days != 1 else ""}. '
                    f'Please select a longer rental period.'
                )
            }, status=400)

        dob = getattr(getattr(request.user, 'customer_profile', None), 'date_of_birth', None)
        if dob:
            today = datetime.date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < min_driver_age:
                return Response({
                    'error': (
                        f'You must be at least {min_driver_age} years old to rent this '
                        f'{vehicle.get_segment_display()}. Please update your date of birth in your '
                        f'profile if this is incorrect.'
                    )
                }, status=400)

        if days < 0:
            return Response({'error': 'Return date cannot be before pickup date.'}, status=400)

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
                            return Response(
                                {
                                    'error': (
                                        f'Pickup time must be between '
                                        f'{opening.strftime("%H:%M")} and '
                                        f'{closing.strftime("%H:%M")}.'
                                    )
                                },
                                status=400
                            )

                    if return_time_s:
                        rt = datetime.time(
                            *[int(x) for x in return_time_s.split(':')]
                        )

                        if not is_within_vendor_hours(rt):
                            print(
                                f'DEBUG Return time {rt} outside vendor hours '
                                f'{opening}-{closing}'
                            )
                            return Response(
                                {
                                    'error': (
                                        f'Return time must be between '
                                        f'{opening.strftime("%H:%M")} and '
                                        f'{closing.strftime("%H:%M")}.'
                                    )
                                },
                                status=400
                            )

            except Exception:
                pass

        # Check date availability — reject if any date in range is blocked
        date_range = [p_date + datetime.timedelta(days=i) for i in range(days + 1)]
        conflicts  = VehicleAvailability.objects.filter(
            vehicle=vehicle, blocked_date__in=date_range).count()
        if conflicts:
            return Response({'error': 'Vehicle is not available for the selected dates.'}, status=409)

        # Calculate price
        breakdown = calculate_price(
            vehicle_segment = vehicle.segment,
            daily_rate      = vehicle.daily_rate,
            rental_days     = days,
            selected_addons = addons,
            one_way_fee     = one_way_fee,
            pickup_time     = pickup_time_s,
            return_time     = return_time_s,
        )

        # Parse time strings to time objects for storage
        def parse_time(t):
            if not t: return None
            try: return datetime.time(*[int(x) for x in t.split(':')])
            except: return None

        # Resolve locations server-side (never trust a client-sent id for the pickup)
        from apps.locations.models import Location
        from django.db import transaction
        pickup_location = (
            vehicle.pickup_location
            or getattr(getattr(vehicle.vendor, 'vendor_profile', None), 'pickup_location', None)
            or (get_object_or_404(Location, pk=pickup_loc_id) if pickup_loc_id else None)
        )
        if pickup_location is None:
            return Response({'error': 'This vehicle has no pickup location configured.'}, status=400)
        return_location = get_object_or_404(Location, pk=return_loc_id) if return_loc_id else None

        if return_location and return_location.id != pickup_location.id:
            err = validate_return_location(return_location, vehicle.vendor_id)
            if err:
                return Response({'error': err}, status=409)        

        with transaction.atomic():
            booking = Booking.objects.create(
                customer            = request.user,
                vehicle             = vehicle,
                vendor              = vehicle.vendor,
                pickup_date         = p_date,
                pickup_time         = parse_time(pickup_time_s),
                return_date         = r_date,
                return_time         = parse_time(return_time_s),
                pickup_location     = pickup_location,
                return_location     = return_location,
                is_one_way          = bool(return_location and return_location.id != pickup_location.id),
                pricing_snapshot    = breakdown,
                total_amount        = Decimal(breakdown['grand_total']),
                deposit_amount      = Decimal(breakdown['security_deposit']),
                agreement_signed    = True,
                agreement_signed_at = dj_timezone.now(),
            )

            for addon_type in addons:
                AddOn.objects.create(
                    booking    = booking,
                    addon_type = addon_type,
                    price      = get_addon_price(addon_type),
                )

            AgreementAcceptance.objects.create(
                user              = request.user,
                agreement_version = active_version,
                booking           = booking,
                ip_address        = _get_client_ip(request),
                user_agent        = _get_user_agent(request),
                otp_verified      = False,
                acceptance_method = 'checkbox',
            )

        # Create Razorpay order
        razorpay_order = _create_razorpay_order(booking)
        booking.razorpay_order_id = razorpay_order.get("id", "")
        booking.save(update_fields=['razorpay_order_id'])

        notify(
            booking.vendor,
            title="New booking received",
            message=(
                f"{request.user.full_name} booked your {vehicle.year} {vehicle.make} {vehicle.model} "
                f"from {p_date} to {r_date}."
            ),
            notification_type='booking_created',
            link_url=f'/vendor?tab=bookings&highlight={booking.id}',
        )

        enqueue(run_event_rules_task, request.user.id, 'payment_pending')

        return Response({
            'booking_id':     booking.id,
            'booking_ref':    booking.booking_ref,
            'pricing':        breakdown,
            'razorpay_order': razorpay_order,
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
 
    total = booking.total_amount
    if hours_to_pickup >= free_hours:
        return {
            'refund_amount': total,
            'policy': f'Full refund (cancelled more than {free_hours}h before pickup)',
        }
    elif hours_to_pickup >= half_hours:
        return {
            'refund_amount': total / 2,
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



def _create_razorpay_order(booking) -> dict:
    import uuid
    stub = {
        'id':        f'order_DEV_{uuid.uuid4().hex[:12]}',
        'amount':    int(booking.total_amount * 100),
        'currency':  'INR', 'status': 'created', '_dev_stub': True,
    }
    if 'placeholder' in (settings.RAZORPAY_KEY_ID or 'placeholder') \
            or 'placeholder' in (settings.RAZORPAY_KEY_SECRET or 'placeholder'):
        return stub                      # no real keys: skip the network round-trip
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        return client.order.create({
            "amount":   int(booking.total_amount * 100),
            "currency": "INR",
            "receipt":  booking.booking_ref,
            "notes":    {"booking_id": str(booking.id), "customer": booking.customer.email},
        })
    except Exception:
        logger.exception('Razorpay order creation failed for booking %s', booking.id)
        return stub
 
class PaymentVerifyView(APIView):
    """POST /api/bookings/{booking_id}/payment/verify/"""
    permission_classes = [IsCustomerRole]

    def post(self, request, booking_id):
        booking    = get_object_or_404(Booking, pk=booking_id, customer=request.user)
        order_id   = request.data.get('razorpay_order_id') or ''
        payment_id = request.data.get('razorpay_payment_id') or ''
        signature  = request.data.get('razorpay_signature') or ''

        if order_id != booking.razorpay_order_id:
            return Response({'error': 'Order does not belong to this booking.'}, status=400)

        is_dev_stub = settings.DEBUG and order_id.startswith('order_DEV_')
        if not is_dev_stub:
            expected = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                f"{order_id}|{payment_id}".encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(expected, signature):
                return Response({'error': 'Payment signature invalid.'}, status=400)

        try:
            _confirm_booking_payment(booking, payment_id)
        except (DateConflict, ReturnCapacityConflict) as exc:
            msg = _conflict_message(exc)
            _cancel_on_conflict(booking, '' if is_dev_stub else payment_id, msg)
            return Response({'error': f'{msg} Any payment taken will be refunded.'}, status=409)

        return Response({'message': 'Payment verified. Booking confirmed.',
                         'booking_ref': booking.booking_ref})


 
class RazorpayWebhookView(APIView):
    """POST /api/bookings/webhook/razorpay/ — HMAC-verified, idempotent, concurrency-safe."""
    permission_classes     = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes       = []          # never rate-limit the payment provider

    def post(self, request):
        sig      = request.headers.get('X-Razorpay-Signature', '')
        body_raw = request.body
        expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode('utf-8'), body_raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return Response({'error': 'Invalid signature.'}, status=400)

        try:
            payload = json.loads(body_raw)
        except ValueError:
            return Response({'error': 'Bad payload.'}, status=400)

        event_type = payload.get('event', '')
        body       = payload.get('payload', {}) or {}
        entity     = ((body.get('payment') or body.get('refund') or {}).get('entity')) or {}
        event_id   = request.headers.get('X-Razorpay-Event-Id') or f"{event_type}:{entity.get('id', '')}"

        booking = None
        if entity.get('order_id'):
            booking = Booking.objects.filter(razorpay_order_id=entity['order_id']).first()
        if not booking and entity.get('payment_id'):
            booking = Booking.objects.filter(razorpay_payment_id=entity['payment_id']).first()
        if not booking:
            return Response({'status': 'no_booking_found'})

        # Unique event_id => concurrent duplicate deliveries: exactly one proceeds.
        try:
            with transaction.atomic():
                PaymentEvent.objects.create(booking=booking, razorpay_event_id=event_id,
                                            event_type=event_type, payload=payload)
        except IntegrityError:
            return Response({'status': 'already_processed'})

        if event_type == 'payment.captured':
            try:
                _confirm_booking_payment(booking, entity.get('id', ''))
            except (DateConflict, ReturnCapacityConflict) as exc:
                _cancel_on_conflict(booking, entity.get('id', ''), _conflict_message(exc))
        elif event_type == 'payment.failed':
            Booking.objects.filter(pk=booking.pk, status='PENDING').update(
                status='CANCELLED', cancellation_reason='Payment failed.')
        elif event_type == 'refund.processed':
            Booking.objects.filter(pk=booking.pk).update(deposit_released=True)

        return Response({'status': 'ok'})

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









# Dummy views for payment flows still in development, to be replaced later.

class DummyPaymentView(APIView):
    """POST /api/bookings/{booking_id}/payment/dummy/ — same contract/response as before."""
    permission_classes = [permissions.IsAuthenticated]
    ADVANCE_PCT = Decimal('0.30')

    def post(self, request, booking_id):
        payment_type    = request.data.get('payment_type', 'advance')
        method          = request.data.get('method', 'online')
        amount_override = request.data.get('amount')
        if payment_type not in ('advance', 'full', 'remaining'):
            return Response({'error': 'payment_type must be advance, full, or remaining.'}, status=400)

        try:
            with transaction.atomic():
                booking = get_object_or_404(Booking.objects.select_for_update(), pk=booking_id)

                if request.user != booking.customer and request.user != booking.vendor \
                        and getattr(request.user, 'role', None) != 'admin':
                    return Response({'error': 'Not authorised.'}, status=403)
                
                if request.user == booking.customer and method != 'online':
                    return Response({'error': 'Only online payment is accepted.'}, status=400)
                
                if booking.status in ('CANCELLED', 'COMPLETED'):
                    return Response({'error': f'Cannot take payment on a {booking.status.lower()} booking.'}, status=400)

                snapshot = dict(booking.pricing_snapshot or {})
                if payment_type == 'advance' and (snapshot.get('advance_paid') or snapshot.get('full_payment_paid')):
                    return Response({'error': 'Advance is already paid.'}, status=400)
                if payment_type == 'remaining' and (snapshot.get('remaining_paid') or snapshot.get('full_payment_paid')):
                    return Response({'error': 'Remaining balance is already paid.'}, status=400)
                if payment_type == 'full' and snapshot.get('full_payment_paid'):
                    return Response({'error': 'Booking is already fully paid.'}, status=400)

                grand_total      = booking.total_amount
                advance_amount   = (grand_total * self.ADVANCE_PCT).quantize(Decimal('0.01'))
                remaining_amount = grand_total - advance_amount

                if amount_override:
                    amount_paid = Decimal(str(amount_override)).quantize(Decimal('0.01'))
                elif payment_type == 'full':
                    amount_paid = grand_total
                elif payment_type == 'remaining':
                    amount_paid = remaining_amount
                else:
                    amount_paid = advance_amount

                snapshot['advance_amount']   = str(advance_amount)
                snapshot['remaining_amount'] = str(remaining_amount)
                snapshot['advance_pct']      = 30

                if payment_type == 'full':
                    snapshot.update(full_payment_paid=True, advance_paid=True, remaining_paid=True,
                                    last_payment_method=method, last_payment_type='full')
                    is_fully_paid = True
                else:
                    if payment_type == 'advance':
                        snapshot['advance_paid']        = True
                        snapshot['advance_paid_method'] = method
                    else:
                        snapshot['remaining_paid']        = True
                        snapshot['remaining_paid_method'] = method
                    is_fully_paid = bool(snapshot.get('advance_paid') and snapshot.get('remaining_paid'))
                    snapshot['full_payment_paid']  = is_fully_paid
                    snapshot['last_payment_method'] = method
                    snapshot['last_payment_type']   = payment_type

                just_confirmed = booking.status == 'PENDING'
                if payment_type in ('advance', 'full'):
                    _block_vehicle_dates(booking)          # raises DateConflict if someone beat us

                booking.pricing_snapshot    = snapshot
                booking.payment_captured    = True
                booking.payment_captured_at = dj_timezone.now()
                if just_confirmed:
                    booking.status       = 'CONFIRMED'
                    booking.deposit_held = True
                booking.save(update_fields=['pricing_snapshot', 'payment_captured',
                                            'payment_captured_at', 'status', 'deposit_held', 'updated_at'])

                if payment_type in ('advance', 'full') and booking.is_one_way:
                    from apps.logistics.views import auto_match_return_partner
                    auto_match_return_partner(booking)
                if just_confirmed:
                    enqueue(booking_tasks.send_booking_confirmation, booking.id)

        except (DateConflict, ReturnCapacityConflict) as exc:
            msg = _conflict_message(exc)
            _cancel_on_conflict(booking, '', msg)
            return Response({'error': f'{msg} Please choose another option.'}, status=409)
        
        current_remaining = Decimal('0') if is_fully_paid else (
            remaining_amount if payment_type == 'advance' else Decimal('0'))

        return Response({
            'success':          True,
            'message':          f'Payment of ₹{amount_paid} recorded successfully via {method}.',
            'payment_type':     payment_type,
            'amount_paid':      str(amount_paid),
            'remaining_amount': str(current_remaining),
            'is_fully_paid':    is_fully_paid,
            'booking_status':   booking.status,
            'booking_ref':      booking.booking_ref,
            'payment_breakdown': {
                'grand_total':      str(grand_total),
                'advance_amount':   str(advance_amount),
                'remaining_amount': str(remaining_amount),
                'advance_pct':      30,
                'advance_paid':     snapshot.get('advance_paid', False),
                'remaining_paid':   snapshot.get('remaining_paid', False),
                'is_fully_paid':    is_fully_paid,
            },
        })
 
 
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
 