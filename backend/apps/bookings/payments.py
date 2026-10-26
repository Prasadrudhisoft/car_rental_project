"""
All payment logic lives here. Views are thin wrappers.

  PaymentService.public_config()   what the frontend may know (mode, public key)
  PaymentService.initiate()        production: create a Razorpay order for advance/full/remaining
  PaymentService.verify()          production: signature check, then settle
  PaymentService.handle_webhook()  production: Razorpay -> us (safety net for closed tabs)
  PaymentService.record_offline()  vendor/admin records cash/UPI received for the balance
  PaymentService.pay_dummy()       DEV ONLY (see dummy_enabled)
  PaymentService.summary()         amounts/flags the UI displays (never computed in the browser)

Every successful payment goes through ONE function, _apply(): row-locked, idempotent, and
the only place that mutates payment state.
"""
import datetime
import hashlib
import hmac
import json
import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.logistics.capacity import ReturnCapacityConflict
from apps.vehicles.models import Vehicle, VehicleAvailability
from car_rent.async_utils import enqueue

from . import tasks as booking_tasks
from .models import Booking, PaymentEvent

logger = logging.getLogger(__name__)
CENT = Decimal('0.01')


class PaymentError(Exception):
    def __init__(self, message, status=400, code='payment_error'):
        super().__init__(message)
        self.status, self.code = status, code


class DateConflict(Exception):
    """Another booking / manual block already holds one of the requested dates."""


def payment_schedule(total):
    total = Decimal(str(total))
    pct = Decimal(str(settings.PAYMENT_ADVANCE_PCT))
    advance = (total * pct / 100).quantize(CENT, ROUND_HALF_UP)
    return {'advance': advance, 'remaining': total - advance, 'advance_pct': int(pct)}


# ── availability / conflict helpers ─────────────────────────────────────────
def _block_vehicle_dates(booking):
    """Row-lock the vehicle so two simultaneous payments for the same dates are serialised."""
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


def conflict_message(exc):
    if isinstance(exc, ReturnCapacityConflict):
        return str(exc) or 'The selected drop point is no longer available.'
    return 'This vehicle was just booked for those dates by another customer.'


def _cancel_on_conflict(booking, gateway_payment_id, reason, refund_amount):
    """Lost the race: cancel the unpaid booking; refund only if real gateway money was taken."""
    Booking.objects.filter(pk=booking.pk, status='PENDING').update(
        status='CANCELLED', cancellation_reason=reason,
        razorpay_payment_id=gateway_payment_id or booking.razorpay_payment_id)
    if gateway_payment_id and refund_amount:
        enqueue(booking_tasks.issue_razorpay_refund, booking.id, str(refund_amount))


class PaymentService:
    TYPES = ('advance', 'full', 'remaining')

    # ── configuration ───────────────────────────────────────────────────────
    @staticmethod
    def dummy_enabled():
        # double lock: DEBUG must be on AND the dev switch must be on
        return bool(settings.DEBUG and settings.PAYMENT_DUMMY_ENABLED)

    @staticmethod
    def gateway_configured():
        key, secret = settings.RAZORPAY_KEY_ID or '', settings.RAZORPAY_KEY_SECRET or ''
        return bool(key and secret) and 'placeholder' not in (key + secret).lower() and 'X' * 6 not in key

    @classmethod
    def mode(cls):
        if cls.dummy_enabled():
            return 'dummy'
        return 'razorpay' if cls.gateway_configured() else 'unavailable'

    @classmethod
    def public_config(cls):
        mode = cls.mode()
        return {'mode': mode, 'currency': 'INR',
                'key_id': settings.RAZORPAY_KEY_ID if mode == 'razorpay' else None,
                'advance_pct': int(settings.PAYMENT_ADVANCE_PCT)}

    @staticmethod
    def _client():
        import razorpay
        return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    # ── amounts / state ─────────────────────────────────────────────────────
    @staticmethod
    def _flags(snap):
        full = bool(snap.get('full_payment_paid'))
        return bool(snap.get('advance_paid')) or full, bool(snap.get('remaining_paid')) or full

    @classmethod
    def amount_due(cls, booking, payment_type, snap=None):
        snap = booking.pricing_snapshot or {} if snap is None else snap
        if payment_type not in cls.TYPES:
            raise PaymentError('payment_type must be advance, full or remaining.')
        if booking.status in ('CANCELLED', 'COMPLETED'):
            raise PaymentError(f'Cannot take payment on a {booking.status.lower()} booking.')
        adv, rem = cls._flags(snap)
        sched = payment_schedule(booking.total_amount)
        if payment_type == 'advance':
            if adv:
                raise PaymentError('Advance is already paid.')
            return sched['advance']
        if payment_type == 'full':
            if adv or rem:
                raise PaymentError('A payment was already made. Pay the remaining balance instead.')
            return Decimal(booking.total_amount)
        if not adv:
            raise PaymentError('Please pay the advance first.')
        if rem:
            raise PaymentError('Remaining balance is already paid.')
        return sched['remaining']

    @classmethod
    def amount_paid(cls, booking):
        snap = booking.pricing_snapshot or {}
        pays = snap.get('payments')
        if pays:
            return sum((Decimal(p['amount']) for p in pays), Decimal('0'))
        adv, rem = cls._flags(snap)
        sched = payment_schedule(booking.total_amount)
        return (sched['advance'] if adv else Decimal('0')) + (sched['remaining'] if rem else Decimal('0'))

    @classmethod
    def summary(cls, booking):
        snap = booking.pricing_snapshot or {}
        adv, rem = cls._flags(snap)
        sched = payment_schedule(booking.total_amount)
        fully = adv and rem
        open_ = booking.status not in ('CANCELLED', 'COMPLETED')
        nxt = None if (fully or not open_) else ('remaining' if adv else 'advance')
        due = {'advance': sched['advance'], 'remaining': sched['remaining']}.get(nxt)
        return {
            'total': str(booking.total_amount), 'advance_pct': sched['advance_pct'],
            'advance_amount': str(sched['advance']), 'remaining_amount': str(sched['remaining']),
            'advance_paid': adv, 'remaining_paid': rem, 'fully_paid': fully,
            'next_type': nxt, 'amount_due_now': str(due) if due is not None else None,
            'amount_paid': str(cls.amount_paid(booking)),
        }

    # ── the ONE place payment state changes ─────────────────────────────────
    @classmethod
    def _apply(cls, booking_id, payment_type, method, ref=''):
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(pk=booking_id)
            snap = dict(booking.pricing_snapshot or {})
            if ref and any(p.get('ref') == ref for p in snap.get('payments', [])):
                return booking, None, False                     # already applied (verify + webhook)

            amount = cls.amount_due(booking, payment_type, snap)
            if payment_type in ('advance', 'full'):
                _block_vehicle_dates(booking)                   # may raise DateConflict -> rollback

            now, sched = timezone.now(), payment_schedule(booking.total_amount)
            snap['payments'] = list(snap.get('payments', [])) + [{
                'type': payment_type, 'amount': str(amount), 'method': method,
                'ref': ref, 'at': now.isoformat()}]
            snap.update(advance_pct=sched['advance_pct'], advance_amount=str(sched['advance']),
                        remaining_amount=str(sched['remaining']),
                        last_payment_method=method, last_payment_type=payment_type)
            if payment_type == 'full':
                snap.update(advance_paid=True, remaining_paid=True)
            elif payment_type == 'advance':
                snap['advance_paid'] = True
            else:
                snap['remaining_paid'] = True
            snap['full_payment_paid'] = bool(snap.get('advance_paid') and snap.get('remaining_paid'))
            snap.pop('pending_payment', None)

            just_confirmed = booking.status == 'PENDING'
            booking.pricing_snapshot = snap
            booking.payment_captured = True
            booking.payment_captured_at = now
            if method == 'razorpay' and ref:
                booking.razorpay_payment_id = ref
            if just_confirmed:
                booking.status, booking.deposit_held = 'CONFIRMED', True
            booking.save(update_fields=['pricing_snapshot', 'payment_captured', 'payment_captured_at',
                                        'razorpay_payment_id', 'status', 'deposit_held', 'updated_at'])

            if payment_type in ('advance', 'full') and booking.is_one_way:
                from apps.logistics.views import auto_match_return_partner
                auto_match_return_partner(booking)               # may raise ReturnCapacityConflict
            if just_confirmed:
                enqueue(booking_tasks.send_booking_confirmation, booking.id)
                enqueue(booking_tasks.generate_agreement_pdf_task, booking.id)
        return booking, amount, True

    @classmethod
    def _settle(cls, booking, payment_type, method, ref=''):
        try:
            amount_expected = cls.amount_due(booking, payment_type)
        except PaymentError:
            amount_expected = None
        try:
            booking, amount, applied = cls._apply(booking.id, payment_type, method, ref)
        except (DateConflict, ReturnCapacityConflict) as exc:
            msg = conflict_message(exc)
            _cancel_on_conflict(booking, ref if method == 'razorpay' else '', msg, amount_expected)
            raise PaymentError(f'{msg} Any payment taken will be refunded.', 409, 'conflict')
        booking.refresh_from_db()
        return {
            'success': True, 'applied': applied, 'payment_type': payment_type,
            'amount_paid': str(amount) if amount is not None else None,
            'message': 'Payment received.' if applied else 'Payment already recorded.',
            'booking_status': booking.status, 'booking_ref': booking.booking_ref,
            'payment_summary': cls.summary(booking),
        }

    # ── production: Razorpay ────────────────────────────────────────────────
    @classmethod
    def initiate(cls, booking, payment_type):
        if cls.mode() != 'razorpay':
            raise PaymentError('Online payments are not available right now.', 503, 'unavailable')
        snap = booking.pricing_snapshot or {}
        amount = cls.amount_due(booking, payment_type, snap)

        pending = snap.get('pending_payment') or {}
        reuse = (pending.get('order_id') and pending.get('type') == payment_type
                 and Decimal(pending.get('amount', '0')) == amount)
        if not reuse:
            try:
                order = cls._client().order.create({
                    'amount': int(amount * 100), 'currency': 'INR', 'receipt': booking.booking_ref,
                    'notes': {'booking_id': str(booking.id), 'payment_type': payment_type}})
            except Exception:
                logger.exception('Razorpay order creation failed for booking %s', booking.id)
                raise PaymentError('Could not start the payment. Please try again.', 502, 'gateway_error')
            pending = {'order_id': order['id'], 'type': payment_type, 'amount': str(amount)}
            with transaction.atomic():
                b = Booking.objects.select_for_update().get(pk=booking.pk)
                s = dict(b.pricing_snapshot or {})
                s['pending_payment'] = pending
                b.pricing_snapshot, b.razorpay_order_id = s, order['id']
                b.save(update_fields=['pricing_snapshot', 'razorpay_order_id', 'updated_at'])

        c = booking.customer
        return {'order_id': pending['order_id'], 'amount': int(amount * 100), 'currency': 'INR',
                'key_id': settings.RAZORPAY_KEY_ID, 'booking_ref': booking.booking_ref,
                'payment_type': payment_type, 'name': 'RudhiDrive',
                'description': f'Booking {booking.booking_ref} — {payment_type} payment',
                'prefill': {'name': c.full_name, 'email': c.email, 'contact': c.phone}}

    @classmethod
    def verify(cls, booking, order_id, payment_id, signature):
        if cls.mode() != 'razorpay':
            raise PaymentError('Online payments are not available right now.', 503, 'unavailable')
        expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(),
                            f'{order_id}|{payment_id}'.encode(), hashlib.sha256).hexdigest()
        if not (order_id and payment_id and signature) or not hmac.compare_digest(expected, str(signature)):
            raise PaymentError('Payment signature invalid.', 400, 'bad_signature')

        snap = booking.pricing_snapshot or {}
        pending = snap.get('pending_payment') or {}
        if pending.get('order_id') != order_id:
            if any(p.get('ref') == payment_id for p in snap.get('payments', [])):
                return cls._settle(booking, 'advance', 'razorpay', payment_id)   # idempotent replay
            raise PaymentError('This payment does not belong to this booking.', 400, 'wrong_order')
        return cls._settle(booking, pending['type'], 'razorpay', payment_id)

    @classmethod
    def handle_webhook(cls, raw_body, signature, event_id):
        secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not secret:
            raise PaymentError('Webhook is not configured.', 503)
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature or ''):
            raise PaymentError('Invalid signature.', 400)
        try:
            payload = json.loads(raw_body)
        except ValueError:
            raise PaymentError('Bad payload.', 400)

        event = payload.get('event', '')
        entity = ((payload.get('payload') or {}).get('payment') or {}).get('entity') or {}
        order_id, payment_id = entity.get('order_id'), entity.get('id', '')
        booking = Booking.objects.filter(razorpay_order_id=order_id).first() if order_id else None
        if not booking:
            return {'status': 'no_booking_found'}

        try:                                           # unique id: concurrent duplicates -> one proceeds
            with transaction.atomic():
                PaymentEvent.objects.create(
                    booking=booking, event_type=event, payload=payload,
                    razorpay_event_id=event_id or f'{event}:{payment_id}')
        except IntegrityError:
            return {'status': 'already_processed'}

        if event == 'payment.captured':
            pending = (booking.pricing_snapshot or {}).get('pending_payment') or {}
            if pending.get('order_id') == order_id:
                try:
                    cls._settle(booking, pending['type'], 'razorpay', payment_id)
                except PaymentError:
                    logger.warning('Webhook settle failed for booking %s', booking.id, exc_info=True)
        return {'status': 'ok'}

    # ── vendor / admin: money received outside the gateway ──────────────────
    @classmethod
    def record_offline(cls, booking, user, method):
        if method not in ('cash', 'upi'):
            raise PaymentError('method must be cash or upi.')
        if not (getattr(user, 'role', None) == 'admin' or user == booking.vendor):
            raise PaymentError('Not authorised.', 403)
        return cls._settle(booking, 'remaining', method, f'offline_{uuid.uuid4().hex[:12]}')

    # ── DEV ONLY ────────────────────────────────────────────────────────────
    @classmethod
    def pay_dummy(cls, booking, payment_type):
        if not cls.dummy_enabled():
            raise PaymentError('Not found.', 404, 'not_found')
        return cls._settle(booking, payment_type, 'dummy', f'dummy_{uuid.uuid4().hex[:12]}')