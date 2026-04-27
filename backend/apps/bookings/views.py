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
 
from apps.configuration.utils import get_config
from apps.vehicles.models import Vehicle, VehicleAvailability
 
from .models import Booking, AddOn, InspectionRecord, InspectionPhoto, Invoice, PaymentEvent
from .pricing import calculate_price, get_addon_price
from .serializers import (
    BookingDetailSerializer, BookingListSerializer,
    InspectionRecordSerializer, InspectionPhotoSerializer, InvoiceSerializer,
)
from . import notifications
import datetime
 
 
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
        vehicle_id     = request.data.get('vehicle_id')
        pickup_date_s  = request.data.get('pickup_date')
        return_date_s  = request.data.get('return_date')
        pickup_time_s  = request.data.get('pickup_time')   # "HH:MM" or None
        return_time_s  = request.data.get('return_time')   # "HH:MM" or None
        pickup_loc_id  = request.data.get('pickup_location')
        return_loc_id  = request.data.get('return_location')
        addons         = request.data.get('addons', [])
        one_way_fee    = Decimal(str(request.data.get('one_way_fee', '0')))

        if not all([vehicle_id, pickup_date_s, return_date_s, pickup_loc_id]):
            return Response({'error': 'vehicle_id, pickup_date, return_date, pickup_location required.'}, status=400)

        vehicle   = get_object_or_404(Vehicle, pk=vehicle_id, status="LIVE")
        p_date    = datetime.date.fromisoformat(pickup_date_s)
        r_date    = datetime.date.fromisoformat(return_date_s)
        days      = (r_date - p_date).days

        if days < 0:
            return Response({'error': 'Return date cannot be before pickup date.'}, status=400)

        # Validate times against vendor shop hours
        if pickup_time_s or return_time_s:
            try:
                opening = vehicle.vendor.vendor_profile.shop_opening_time
                closing = vehicle.vendor.vendor_profile.shop_closing_time
                if opening and closing and pickup_time_s:
                    pt = datetime.time(*[int(x) for x in pickup_time_s.split(':')])
                    if not (opening <= pt <= closing):
                        return Response(
                            {'error': f'Pickup time must be between {opening.strftime("%H:%M")} and {closing.strftime("%H:%M")}.'},
                            status=400
                        )
                if opening and closing and return_time_s and days == 0:
                    rt = datetime.time(*[int(x) for x in return_time_s.split(':')])
                    if not (opening <= rt <= closing):
                        return Response(
                            {'error': f'Return time must be between {opening.strftime("%H:%M")} and {closing.strftime("%H:%M")}.'},
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

        # Create booking (PENDING)
        from apps.locations.models import Location
        booking = Booking.objects.create(
            customer         = request.user,
            vehicle          = vehicle,
            vendor           = vehicle.vendor,
            pickup_date      = p_date,
            pickup_time      = parse_time(pickup_time_s),
            return_date      = r_date,
            return_time      = parse_time(return_time_s),
            pickup_location  = get_object_or_404(Location, pk=pickup_loc_id),
            return_location  = get_object_or_404(Location, pk=return_loc_id) if return_loc_id else None,
            is_one_way       = bool(return_loc_id and return_loc_id != pickup_loc_id),
            pricing_snapshot = breakdown,
            total_amount     = Decimal(breakdown['grand_total']),
            deposit_amount   = Decimal(breakdown['security_deposit']),
        )

        # Save add-ons
        for addon_type in addons:
            AddOn.objects.create(
                booking    = booking,
                addon_type = addon_type,
                price      = get_addon_price(addon_type),
            )

        # Create Razorpay order
        razorpay_order = _create_razorpay_order(booking)
        booking.razorpay_order_id = razorpay_order.get("id", "")
        booking.save()

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
    """
    POST /api/bookings/{booking_id}/cancel/
    Calculates refund based on how far in advance the cancellation is made.
    All thresholds are read from the configuration system.
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
 
        # Only customer or admin can cancel
        if request.user != booking.customer and request.user.role != "admin":
            return Response({'error': 'Not authorised.'}, status=403)
 
        if booking.status not in ['PENDING', 'CONFIRMED']:
            return Response({'error': 'Cannot cancel a booking that is ACTIVE or COMPLETED.'}, status=400)
 
        # Calculate refund based on config-driven policy
        refund = _calculate_cancellation_refund(booking)
 
        booking.status             = 'CANCELLED'
        booking.cancellation_reason = request.data.get('reason', '')
        booking.cancelled_by       = request.user
        booking.save()
 
        # Unblock dates in availability
        VehicleAvailability.objects.filter(
            vehicle  = booking.vehicle,
            reason   = 'booking',
            booking_ref = booking.booking_ref,
        ).delete()
 
        # Trigger refund via Razorpay if payment was captured
        if booking.payment_captured and refund["refund_amount"] > 0:
            _issue_razorpay_refund(booking, refund["refund_amount"])
 
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
        ).select_related("vehicle", "pickup_location").prefetch_related("addons")
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st else qs
 
 
class CustomerBookingDetailView(generics.RetrieveAPIView):
    """GET /api/bookings/my/{booking_id}/ — full booking detail"""
    serializer_class   = BookingDetailSerializer
    permission_classes = [IsCustomerRole]
 
    def get_queryset(self):
        return Booking.objects.filter(customer=self.request.user).prefetch_related(
            "addons", "inspections__photos", "invoice")
 
 
class VendorBookingListView(generics.ListAPIView):
    """GET /api/bookings/vendor/ — vendor sees bookings for their vehicles"""
    serializer_class   = BookingListSerializer
    permission_classes = [IsVendorRole]
 
    def get_queryset(self):
        qs = Booking.objects.filter(
            vendor=self.request.user
        ).select_related("customer", "vehicle")
        st = self.request.query_params.get('status')
        return qs.filter(status=st) if st else qs
 
 
class AdminBookingListView(generics.ListAPIView):
    """GET /api/bookings/admin/ — admin sees all bookings"""
    serializer_class   = BookingDetailSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        return Booking.objects.select_related(
            "customer", "vehicle", "vendor"
        ).prefetch_related("addons", "inspections")



def _create_razorpay_order(booking) -> dict:
    """
    Create a Razorpay payment order for the booking total.
    Razorpay amounts are in smallest currency unit (paise for INR).
    Returns the Razorpay order dict or a stub dict in dev mode.
    """
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        amount_paise = int(booking.total_amount * 100)
        order = client.order.create({
            "amount":   amount_paise,
            "currency": "INR",
            "receipt":  booking.booking_ref,
            "notes":    {
                "booking_id": str(booking.id),
                "customer":   booking.customer.email,
            }
        })
        return order
    except Exception as e:
        # Dev stub — returns a fake order so flow can be tested without live keys
        import uuid
        return {
            'id':       f'order_DEV_{uuid.uuid4().hex[:12]}',
            'amount':   int(booking.total_amount * 100),
            'currency': 'INR',
            'status':   'created',
            '_dev_stub': True,
        }
 
 
def _issue_razorpay_refund(booking, amount: Decimal):
    """Issue a refund to the customer. Called on cancellation."""
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        client.payment.refund(booking.razorpay_payment_id, {
            "amount": int(amount * 100),
            "notes":  {"reason": booking.cancellation_reason},
        })
    except Exception:
        pass  # Log and handle manually in production
 
 
class PaymentVerifyView(APIView):
    """
    POST /api/bookings/{booking_id}/payment/verify/
    Called by frontend after Razorpay checkout completes.
    Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 
    Verifies HMAC signature to confirm payment is genuine.
    On success: marks booking CONFIRMED, blocks vehicle dates, sends notifications.
    """
    permission_classes = [IsCustomerRole]
 
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id, customer=request.user)
 
        order_id   = request.data.get('razorpay_order_id')
        payment_id = request.data.get('razorpay_payment_id')
        signature  = request.data.get('razorpay_signature')
 
        # DEV STUB: skip verification if no real keys configured
        is_dev_stub = order_id and order_id.startswith('order_DEV_')
 
        if not is_dev_stub:
            # Verify HMAC-SHA256 signature
            message  = f"{order_id}|{payment_id}"
            expected = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected, signature):
                return Response({'error': 'Payment signature invalid.'}, status=400)
 
        booking.razorpay_payment_id = payment_id
        booking.payment_captured    = True
        booking.payment_captured_at = dj_timezone.now()
        booking.status              = 'CONFIRMED'
        booking.deposit_held        = True
        booking.save()
 
        # Block vehicle dates in availability
        import datetime
        days = (booking.return_date - booking.pickup_date).days
        for i in range(days + 1):
            date = booking.pickup_date + datetime.timedelta(days=i)
            VehicleAvailability.objects.get_or_create(
                vehicle=booking.vehicle,
                blocked_date=date,
                defaults={'reason': 'booking', 'booking_ref': booking.booking_ref}
            )
 
        # Generate agreement PDF and send confirmation notification
        from .pdf_generator import generate_agreement_pdf
        from . import notifications
        generate_agreement_pdf(booking)
        notifications.send_booking_confirmation.delay(booking.id)
 
        return Response({'message': 'Payment verified. Booking confirmed.',
                         'booking_ref': booking.booking_ref})


 
class RazorpayWebhookView(APIView):
    """
    POST /api/bookings/webhook/razorpay/
    Receives payment events from Razorpay.
    Must be added to CSRF_EXEMPT list or use @csrf_exempt.
    Razorpay signs each webhook with X-Razorpay-Signature header.
    """
    permission_classes = [permissions.AllowAny]   # Verified by HMAC, not JWT
 
    def post(self, request):
        sig       = request.headers.get('X-Razorpay-Signature', '')
        body_raw  = request.body
 
        # Verify webhook signature
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
            body_raw,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return Response({'error': 'Invalid signature.'}, status=400)
 
        payload   = json.loads(body_raw)
        event_id  = payload.get('id', '')
        event_type = payload.get('event', '')
 
        # Idempotency check — skip if already processed
        if PaymentEvent.objects.filter(razorpay_event_id=event_id).exists():
            return Response({'status': 'already_processed'})
 
        # Find matching booking
        try:
            receipt = payload['payload']['payment']['entity']['description']
            booking = Booking.objects.get(booking_ref=receipt)
        except (KeyError, Booking.DoesNotExist):
            return Response({'status': 'no_booking_found'})
 
        # Log the event
        PaymentEvent.objects.create(
            booking          = booking,
            razorpay_event_id = event_id,
            event_type       = event_type,
            payload          = payload,
        )
 
        # Handle event types
        if event_type == 'payment.captured':
            if booking.status == 'PENDING':
                booking.status = 'CONFIRMED'
                booking.payment_captured = True
                booking.payment_captured_at = dj_timezone.now()
                booking.save()
        elif event_type == 'payment.failed':
            booking.status = 'CANCELLED'
            booking.cancellation_reason = 'Payment failed.'
            booking.save()
        elif event_type == 'refund.processed':
            booking.deposit_released = True
            booking.save()
 
        return Response({'status': 'ok'})


# class AgreementSignView(APIView):
#     """
#     POST /api/bookings/{booking_id}/sign/

#     Customer signs the rental agreement using an OTP.
#     Step 1: Send OTP  → POST with { "step": "send" }
#     Step 2: Verify OTP → POST with { "step": "verify", "otp_code": "123456" }
 
#     Once signed, agreement_signed=True and booking can proceed to pickup.
#     """
#     permission_classes = [IsCustomerRole]
 
#     def post(self, request, booking_id):
#         booking = get_object_or_404(Booking, pk=booking_id, customer=request.user)
 
#         if booking.agreement_signed:
#             return Response({'message': 'Agreement already signed.'})
 
#         step = request.data.get('step')
 
#         if step == 'send':
#             from apps.otp.models import OTPRecord
#             otp = OTPRecord.generate(request.user, 'agreement_sign')
#             # OTP sent via email/SMS (console in dev)
#             from django.core.mail import send_mail
#             send_mail(
#                 subject    = f"CarRent India — Agreement Signing OTP: {otp.code}",
#                 message    = f"Use OTP {otp.code} to sign your rental agreement for booking {booking.booking_ref}.",
#                 from_email = "noreply@carrentindia.com",
#                 recipient_list = [request.user.email],
#                 fail_silently  = True,
#             )
#             return Response({'message': 'OTP sent to your email.'})
 
#         elif step == 'verify':
#             from apps.otp.models import OTPRecord
#             otp_code = request.data.get('otp_code')
#             try:
#                 otp = OTPRecord.objects.filter(
#                     user    = request.user,
#                     purpose = 'agreement_sign',
#                     is_used = False,
#                 ).latest("created_at")
#             except OTPRecord.DoesNotExist:
#                 return Response({'error': 'No active OTP. Request a new one.'}, status=400)
 
#             if not otp.is_valid() or otp.code != otp_code:
#                 return Response({'error': 'Invalid or expired OTP.'}, status=400)
 
#             otp.is_used        = True
#             otp.save()
#             booking.agreement_signed    = True
#             booking.agreement_signed_at = dj_timezone.now()
#             booking.save()
#             return Response({'message': 'Agreement signed successfully. You may now proceed to pickup.'})
 
#         else:
#             return Response({'error': 'step must be "send" or "verify".'}, status=400)

class AgreementSignView(APIView):
    """
    POST /api/bookings/{booking_id}/sign/
 
    Two-step OTP-based digital signature flow.
 
    Step 1: POST { "step": "send" }
        → Sends OTP to customer's email.
        → Also returns the active agreement version ID so the frontend
          can fetch and display the correct T&C content before signing.
 
    Step 2: POST { "step": "verify", "otp_code": "123456", "version_id": <int> }
        → Verifies OTP.
        → Creates an immutable AgreementAcceptance record with IP + user_agent.
        → Marks booking.agreement_signed = True.
        → Returns version_tag for confirmation display.
    """
    permission_classes = [IsCustomerRole]
 
    def post(self, request, booking_id):
        from apps.agreements.models import AgreementVersion, AgreementAcceptance
        from django.utils import timezone as dj_tz
 
        booking = get_object_or_404(Booking, pk=booking_id, customer=request.user)
 
        if booking.agreement_signed:
            # Already signed — return the acceptance record info
            latest = AgreementAcceptance.objects.filter(
                user=request.user, booking=booking
            ).order_by('-accepted_at').first()
            return Response({
                'message': 'Agreement already signed.',
                'already_signed': True,
                'version_tag': latest.agreement_version.version_tag if latest else None,
                'accepted_at': latest.accepted_at if latest else None,
            })
 
        step = request.data.get('step')
        HARDCODED_OTP = "123456"  # Dev mode — replace with OTPRecord in production
 
        if step == 'send':
            # Fetch active version so frontend can display the right T&C
            active_version = AgreementVersion.get_active()
            if not active_version:
                return Response(
                    {'error': 'No active agreement version found. Contact support.'},
                    status=503,
                )
            return Response({
                'message': f'OTP sent (dev mode). Use {HARDCODED_OTP}',
                'version_id': active_version.id,
                'version_tag': active_version.version_tag,
            })
 
        elif step == 'verify':
            otp_code   = request.data.get('otp_code')
            version_id = request.data.get('version_id')
 
            if otp_code != HARDCODED_OTP:
                return Response({'error': 'Invalid OTP.'}, status=400)
 
            # Validate the version the user claims to have accepted
            if not version_id:
                return Response({'error': 'version_id is required for verification.'}, status=400)
            try:
                version = AgreementVersion.objects.get(pk=version_id)
            except AgreementVersion.DoesNotExist:
                return Response({'error': 'Invalid agreement version.'}, status=400)
 
            # ── Extract request metadata for legal audit ──────────────
            xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
            ip_address = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR', '')
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
 
            # ── Create immutable acceptance record ────────────────────
            AgreementAcceptance.objects.create(
                user              = request.user,
                agreement_version = version,
                booking           = booking,
                ip_address        = ip_address,
                user_agent        = user_agent,
                otp_verified      = True,
                acceptance_method = 'otp_sign',
            )
 
            # ── Update booking ─────────────────────────────────────────
            booking.agreement_signed    = True
            booking.agreement_signed_at = dj_tz.now()
            booking.save(update_fields=['agreement_signed', 'agreement_signed_at'])
 
            return Response({
                'message': 'Agreement signed successfully. You may now proceed to pickup.',
                'version_tag':  version.version_tag,
                'version_id':   version.id,
                'accepted_at':  booking.agreement_signed_at,
            })
 
        else:
            return Response({'error': 'step must be "send" or "verify".'}, status=400)
 

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
 
        record = InspectionRecord.objects.filter(
            booking=booking,
            inspection_type=insp_type
        ).first()

        if not record:
            record = InspectionRecord.objects.create(
                booking=booking,
                inspection_type=insp_type,
                odometer_reading=request.data.get("odometer_reading", 0),
                fuel_level=request.data.get("fuel_level", ""),
                notes=request.data.get("notes", ""),
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
            record.damage_reported = request.data.get("damage_reported", False)
            record.damage_notes    = request.data.get("damage_notes", "")
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
 
 
# class InspectionSignView(APIView):
#     """
#     POST /api/bookings/{booking_id}/inspect/{inspection_type}/sign/
#     Customer or vendor signs the inspection via OTP.
#     When both have signed, the record is locked.
#     Booking advances to ACTIVE (on pickup lock) or COMPLETED (on return lock).
#     """
#     permission_classes = [permissions.IsAuthenticated]
 
#     def post(self, request, booking_id, inspection_type):
#         from apps.otp.models import OTPRecord
#         booking   = get_object_or_404(Booking, pk=booking_id)
#         insp_type = inspection_type.upper()
#         record    = get_object_or_404(InspectionRecord,
#                                        booking=booking, inspection_type=insp_type)
 
#         step     = request.data.get('step')   # 'send' or 'verify'
#         otp_code = request.data.get('otp_code')
 
#         is_customer = request.user == booking.customer
#         is_vendor   = request.user == booking.vendor
#         if not (is_customer or is_vendor):
#             return Response({'error': 'Not authorised.'}, status=403)
 
#         if step == 'send':
#             otp = OTPRecord.generate(request.user, 'inspection_sign')
#             from django.core.mail import send_mail
#             send_mail(
#                 subject    = f"Inspection Sign OTP: {otp.code}",
#                 message    = f"Your OTP for signing the {insp_type.lower()} inspection is: {otp.code}",
#                 from_email = "noreply@carrentindia.com",
#                 recipient_list = [request.user.email],
#                 fail_silently  = True,
#             )
#             return Response({'message': 'OTP sent.'})
 
#         elif step == 'verify':
#             try:
#                 otp = OTPRecord.objects.filter(
#                     user=request.user,
#                     purpose='inspection_sign',
#                     is_used=False
#                 ).latest("created_at")
#             except OTPRecord.DoesNotExist:
#                 return Response({'error': 'No active OTP.'}, status=400)
 
#             if not otp.is_valid() or otp.code != otp_code:
#                 return Response({'error': 'Invalid or expired OTP.'}, status=400)
 
#             otp.is_used = True
#             otp.save()
 
#             if is_customer:
#                 record.customer_signed    = True
#                 record.customer_signed_at = dj_timezone.now()
#             if is_vendor:
#                 record.vendor_signed    = True
#                 record.vendor_signed_at = dj_timezone.now()
 
#             # Lock when both have signed
#             if record.customer_signed and record.vendor_signed:
#                 record.is_locked = True
#                 if insp_type == 'PICKUP':
#                     booking.status = 'ACTIVE'
#                 elif insp_type == 'RETURN':
#                     booking.status = 'COMPLETED'
#                     if not record.damage_reported:
#                         booking.deposit_released = True
#                     # Generate invoice
#                     from .pdf_generator import generate_invoice_pdf
#                     generate_invoice_pdf(booking)
#                     # Credit loyalty points
#                     _credit_loyalty_points(booking)
#                 booking.save()
 
#             record.save()
#             return Response({'message': 'Signed.', 'is_locked': record.is_locked})
 
#         else:
#             return Response({'error': 'step must be send or verify.'}, status=400)

 
import random
from django.utils import timezone as dj_timezone
from datetime import timedelta
from .models import InspectionOTP
 
 
class InspectionSignView(APIView):
    """
    POST /api/bookings/{booking_id}/inspect/{inspection_type}/sign/
 
    Two-step OTP flow:
 
    PICKUP inspection:
      - Customer fills form and submits it
      - Vendor reviews it and calls step=generate → gets OTP → shares with customer
      - Customer enters OTP and calls step=verify → both signed → locked → booking ACTIVE
 
    RETURN inspection:
      - Vendor fills form and submits it
      - Customer reviews it and calls step=generate → gets OTP → shares with vendor
      - Vendor enters OTP and calls step=verify → both signed → locked → booking COMPLETED
 
    Signature rule (the fix):
      When either party verifies the OTP, BOTH signatures are set.
      The party that generated the OTP already implicitly approved by generating it.
      The party that verifies the OTP completes the process.
      → Both customer_signed and vendor_signed are always set together on verify.
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def _generate_otp(self):
        return str(random.randint(100000, 999999))
 
    def post(self, request, booking_id, inspection_type):
        booking   = get_object_or_404(Booking, pk=booking_id)
        insp_type = inspection_type.upper()
        record    = get_object_or_404(InspectionRecord, booking=booking, inspection_type=insp_type)
 
        step     = request.data.get('step')
        otp_code = request.data.get('otp_code')
 
        is_customer = request.user == booking.customer
        is_vendor   = request.user == booking.vendor
 
        if not (is_customer or is_vendor):
            return Response({'error': 'Not authorised.'}, status=403)
 
        # ── GENERATE OTP ──────────────────────────────────────────────────
        if step == 'generate':
            if record.is_locked:
                return Response({'error': 'Inspection is already locked.'}, status=400)
 
            generated_otp = self._generate_otp()
 
            # Invalidate any existing unused OTPs for this inspection
            InspectionOTP.objects.filter(inspection=record, is_used=False).delete()
 
            # Create new OTP (expires in 10 minutes — increased from 5 for usability)
            InspectionOTP.objects.create(
                inspection = record,
                otp_code   = generated_otp,
                expires_at = dj_timezone.now() + timedelta(minutes=10),
            )
 
            # PICKUP: vendor generates OTP to give to customer
            # RETURN: customer generates OTP to give to vendor
            if insp_type == 'PICKUP':
                recipient = 'customer'
                message   = 'Share this OTP with the customer to complete pickup.'
            else:
                recipient = 'vendor'
                message   = 'Share this OTP with the vendor to complete drop-off.'
 
            return Response({
                'message':    message,
                'otp_code':   generated_otp,
                'recipient':  recipient,
                'expires_in': 600,  # 10 minutes in seconds
            })
 
        # ── VERIFY OTP ────────────────────────────────────────────────────
        elif step == 'verify':
            if not otp_code:
                return Response({'error': 'OTP code is required for verification.'}, status=400)
 
            if record.is_locked:
                return Response({'error': 'Inspection is already locked.'}, status=400)
 
            # Find the OTP record
            try:
                otp_record = InspectionOTP.objects.get(
                    inspection = record,
                    otp_code   = otp_code,
                    is_used    = False,
                )
            except InspectionOTP.DoesNotExist:
                return Response({'error': 'Invalid OTP. Please ask for a new one.'}, status=400)
 
            # Check expiry
            if not otp_record.is_valid():
                otp_record.is_used = True
                otp_record.save()
                return Response({'error': 'OTP has expired. Please generate a new one.'}, status=400)
 
            # Mark OTP as used
            otp_record.is_used = True
            otp_record.save()
 
            # ── THE FIX ───────────────────────────────────────────────────
            # Whoever verifies the OTP completes BOTH signatures.
            #
            # Logic:
            # - The party that generated the OTP already gave their approval
            #   (vendor reviewing pickup details then generating OTP = vendor approved)
            #   (customer reviewing dropoff details then generating OTP = customer approved)
            # - The party that verifies the OTP confirms their side.
            # - Therefore: verify always sets both customer_signed AND vendor_signed.
            #
            # Before this fix, only the verifier's signature was set for PICKUP,
            # so vendor_signed stayed False → is_locked never became True.
            # ─────────────────────────────────────────────────────────────
            now = dj_timezone.now()
 
            record.customer_signed    = True
            record.customer_signed_at = record.customer_signed_at or now
            record.vendor_signed      = True
            record.vendor_signed_at   = record.vendor_signed_at or now
 
            # Both are now signed → lock the inspection
            record.is_locked = True
 
            # Advance booking status
            if insp_type == 'PICKUP':
                booking.status = 'ACTIVE'
            elif insp_type == 'RETURN':
                booking.status = 'COMPLETED'
                if not record.damage_reported:
                    booking.deposit_released = True
 
                # Generate invoice
                try:
                    from .pdf_generator import generate_invoice_pdf
                    generate_invoice_pdf(booking)
                except Exception:
                    pass
 
                # Credit loyalty points
                try:
                    self._credit_loyalty_points(booking)
                except Exception:
                    pass
 
            booking.save()
            record.save()
 
            return Response({
                'message':         f'{"Pickup" if insp_type == "PICKUP" else "Drop-off"} inspection completed!',
                'is_locked':       record.is_locked,
                'customer_signed': record.customer_signed,
                'vendor_signed':   record.vendor_signed,
                'booking_status':  booking.status,
            })
 
        else:
            return Response({'error': 'step must be "generate" or "verify".'}, status=400)
 
    def _credit_loyalty_points(self, booking):
        from apps.configuration.utils import get_config
        from decimal import Decimal
        rate    = get_config('loyalty_points_per_inr', Decimal('0.10'))
        points  = int(float(booking.total_amount) * float(rate))
        profile = booking.customer.customer_profile
        profile.loyalty_points += points
        profile.save(update_fields=["loyalty_points"])

 
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
 
        status_counts = {}
        for s in ['CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED']:
            status_counts[s] = qs.filter(status=s).count()
 
        return Response({
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
        })
 
 
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
 
        return Response({
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
        })

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
    """
    POST /api/bookings/{booking_id}/payment/dummy/
 
    Development-only dummy payment that always succeeds.
    Replaces the Razorpay flow while in development.
 
    Body:
        {
            "payment_type": "advance" | "full",   // which payment is being made
            "method": "cash" | "upi" | "online",  // how they paid
            "amount": "1500.00"                    // optional override (auto-calculated if omitted)
        }
 
    Returns:
        {
            "success": true,
            "message": "...",
            "payment_type": "advance",
            "amount_paid": "1500.00",
            "remaining_amount": "3500.00",
            "booking_status": "CONFIRMED",
            "booking_ref": "CRI-000001",
            "payment_breakdown": {
                "grand_total": "5000.00",
                "advance_amount": "1500.00",  // 30% of grand total
                "remaining_amount": "3500.00",
                "advance_pct": 30,
                "is_fully_paid": false
            }
        }
 
    Payment flow:
        1. advance payment  → booking status: PENDING → CONFIRMED
        2. full payment     → booking status: PENDING → CONFIRMED (and marks fully paid)
        3. remaining payment → already CONFIRMED, records remaining balance paid
    """
    permission_classes = [permissions.IsAuthenticated]
 
    ADVANCE_PCT = Decimal('0.30')   # 30% advance
 
    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
 
        # Both customer and vendor are allowed to trigger payment recording
        if request.user != booking.customer and request.user != booking.vendor:
            if not (request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'):
                return Response({'error': 'Not authorised.'}, status=403)
 
        payment_type = request.data.get('payment_type', 'advance')   # 'advance' | 'full'
        method       = request.data.get('method', 'online')           # 'cash' | 'upi' | 'online'
        amount_override = request.data.get('amount')
 
        if payment_type not in ('advance', 'full', 'remaining'):
            return Response({'error': 'payment_type must be advance, full, or remaining.'}, status=400)
 
        grand_total     = booking.total_amount
        advance_amount  = (grand_total * self.ADVANCE_PCT).quantize(Decimal('0.01'))
        remaining_amount = grand_total - advance_amount
 
        # Determine what amount is being paid now
        if amount_override:
            amount_paid = Decimal(str(amount_override)).quantize(Decimal('0.01'))
        elif payment_type == 'full':
            amount_paid = grand_total
        elif payment_type == 'remaining':
            amount_paid = remaining_amount
        else:
            amount_paid = advance_amount  # default: advance
 
        # ── Record in pricing_snapshot so frontend can display clearly ──
        snapshot = booking.pricing_snapshot or {}
        snapshot['advance_amount']   = str(advance_amount)
        snapshot['remaining_amount'] = str(remaining_amount)
        snapshot['advance_pct']      = 30
 
        if payment_type == 'full':
            # Full payment → mark everything paid
            snapshot['full_payment_paid']    = True
            snapshot['advance_paid']         = True
            snapshot['remaining_paid']       = True
            snapshot['last_payment_method']  = method
            snapshot['last_payment_type']    = 'full'
            is_fully_paid = True
        elif payment_type in ('advance', 'remaining'):
            if payment_type == 'advance':
                snapshot['advance_paid']        = True
                snapshot['advance_paid_method'] = method
            else:
                snapshot['remaining_paid']        = True
                snapshot['remaining_paid_method'] = method
            # Check if both advance + remaining are now paid
            is_fully_paid = snapshot.get('advance_paid') and snapshot.get('remaining_paid')
            snapshot['full_payment_paid'] = is_fully_paid
            snapshot['last_payment_method'] = method
            snapshot['last_payment_type']   = payment_type
 
        booking.pricing_snapshot    = snapshot
        booking.payment_captured    = True
        booking.payment_captured_at = dj_timezone.now()
 
        # Advance status to CONFIRMED if still PENDING
        if booking.status == 'PENDING':
            booking.status        = 'CONFIRMED'
            booking.deposit_held  = True
 
        booking.save()
 
        # Block vehicle dates when first payment goes through
        if payment_type in ('advance', 'full'):
            days = (booking.return_date - booking.pickup_date).days
            for i in range(days + 1):
                date = booking.pickup_date + datetime.timedelta(days=i)
                VehicleAvailability.objects.get_or_create(
                    vehicle=booking.vehicle,
                    blocked_date=date,
                    defaults={'reason': 'booking', 'booking_ref': booking.booking_ref}
                )
 
        # Send confirmation notification if just confirmed
        try:
            from . import notifications
            notifications.send_booking_confirmation.delay(booking.id)
        except Exception:
            pass
 
        current_remaining = Decimal('0') if is_fully_paid else (
            remaining_amount if payment_type == 'advance' else Decimal('0')
        )
 
        return Response({
            'success':         True,
            'message':         f'Payment of ₹{amount_paid} recorded successfully via {method}.',
            'payment_type':    payment_type,
            'amount_paid':     str(amount_paid),
            'remaining_amount': str(current_remaining),
            'is_fully_paid':   is_fully_paid,
            'booking_status':  booking.status,
            'booking_ref':     booking.booking_ref,
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
 