"""
Booking lifecycle: no-show, vendor reschedule, customer modification/upgrade.

ASSUMPTIONS about your existing code (adjust names if they differ):
  - Booking has: status, pickup_date, return_date, pickup_time, return_time, vehicle,
    customer, vendor, total_amount (grand total), amount_paid, no_show_at (NEW),
    modification_count (NEW).
  - pricing.build_quote(vehicle, pickup_date, return_date, pickup_time, return_time,
    addons, return_city, promo_code, customer) -> dict with grand_total, available.
  - Date blocking helpers: release_dates(booking) / block_dates(booking) in this app.
  - Statuses 'CONFIRMED', 'ACTIVE', 'CANCELLED', 'NO_SHOW' exist (NO_SHOW is NEW).
Every state change is atomic, row-locked, and written to the ActivityLog.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.activity.services import log_activity, diff
from apps.configuration.utils import get_config

from datetime import timedelta as _td

from apps.vehicles.models import VehicleAvailability

from .models import Booking
from .pricing import build_quote, one_way_fee_for

NO_SHOW_GRACE_HOURS_DEFAULT = 4
NO_SHOW_RETAINED_PCT = Decimal('0.30')   # advance is kept; remainder never charged


class LifecycleError(Exception):
    pass


# ── Date blocking (matches how payment/confirm code blocks dates today) ─────
def _span(pickup_date, return_date):
    return [pickup_date + _td(days=i) for i in range((return_date - pickup_date).days + 1)]


def block_dates(b):
    for d in _span(b.pickup_date, b.return_date):
        VehicleAvailability.objects.get_or_create(
            vehicle=b.vehicle, blocked_date=d,
            defaults={'reason': 'booking', 'booking_ref': b.booking_ref})


def release_dates(b):
    VehicleAvailability.objects.filter(
        vehicle=b.vehicle, reason='booking', booking_ref=b.booking_ref).delete()


def release_return_slot(b):
    """ADAPTER: call your logistics release_return_slot(booking) if present."""
    try:
        from apps.logistics.capacity import release_return_slot as _rel
    except ImportError:
        return
    _rel(b)


def _paid(b):
    """ADAPTER: amount actually collected. Uses amount_paid if your model has it."""
    return getattr(b, 'amount_paid', None) or (b.total_amount if b.payment_captured else Decimal('0'))


def _pickup_dt(b):
    t = b.pickup_time or datetime.min.time()
    return timezone.make_aware(datetime.combine(b.pickup_date, t))


def _free_window_hours():
    return int(get_config('cancellation_free_hours', 48))


# ── A. No-show ──────────────────────────────────────────────────────────────
@transaction.atomic
def mark_no_show(booking_id, *, actor=None, request=None, auto=False):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    if b.status != 'CONFIRMED':
        raise LifecycleError('Only confirmed, not-yet-collected bookings can be no-shows.')
    grace = int(get_config('no_show_grace_hours', NO_SHOW_GRACE_HOURS_DEFAULT))
    if timezone.now() < _pickup_dt(b) + timedelta(hours=grace):
        raise LifecycleError(f'Grace period of {grace}h has not elapsed.')
    old = {'status': b.status}
    b.status = 'NO_SHOW'
    b.no_show_at = timezone.now()
    b.save(update_fields=['status', 'no_show_at'])
    release_dates(b)           # free the car for other customers
    release_return_slot(b)     # free the one-way return slot, if any
    # No refund: advance is retained (see policy). Nothing is charged further.
    log_activity(action='no_show', module='booking', request=request, actor=actor, entity=b,
                 summary=f'Booking {b.pk} marked no-show' + (' (auto)' if auto else ''),
                 old=old, new={'status': 'NO_SHOW', 'amount_retained': str(_paid(b))})
    return b


# ── B. Vendor-initiated reschedule ──────────────────────────────────────────
@transaction.atomic
def vendor_reschedule(booking_id, *, vendor_user, new_pickup_date, new_return_date,
                      new_pickup_time=None, new_return_time=None, reason='', request=None):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    if b.vendor_id != vendor_user.id:
        raise LifecycleError('Not your booking.')
    if b.status != 'CONFIRMED':
        raise LifecycleError('Only confirmed bookings can be rescheduled.')
    if not (reason or '').strip():
        raise LifecycleError('A reason is required.')
    _validate_dates(new_pickup_date, new_return_date)
    _ensure_available(b, new_pickup_date, new_return_date)
    old = {'pickup_date': b.pickup_date, 'return_date': b.return_date}
    release_dates(b)
    b.pickup_date, b.return_date = new_pickup_date, new_return_date
    b.pickup_time = new_pickup_time or b.pickup_time
    b.return_time = new_return_time or b.return_time
    b.reschedule_reason = reason
    b.save()
    block_dates(b)
    # Price is NOT changed for a vendor-initiated move; the customer is notified and
    # may cancel for a full refund regardless of the free window (see cancel view).
    b.vendor_rescheduled = True
    b.save(update_fields=['vendor_rescheduled'])
    log_activity(action='reschedule', module='booking', request=request, actor=vendor_user, entity=b,
                 summary=f'Vendor rescheduled booking {b.pk}: {reason}',
                 old=old, new={'pickup_date': new_pickup_date, 'return_date': new_return_date})
    return b


# ── C/D. Customer modification & vehicle upgrade ────────────────────────────
def quote_modification(b, *, pickup_date, return_date, pickup_time=None, return_time=None,
                       vehicle=None, return_city=None):
    """Pure preview. Returns the price delta against what was actually paid for."""

    _validate_dates(pickup_date, return_date)

    veh = vehicle or b.vehicle

    # Existing booking add-ons
    addons = [a.addon_type for a in b.addons.all()]

    # Calculate one-way fee using the existing pricing helper.
    # Vehicle city is the starting city; return_city is the destination city.
    return_city_id = getattr(return_city, 'pk', return_city)

    one_way_fee = one_way_fee_for(
        veh.city_id,
        return_city_id
    )

    # Use the actual build_quote() argument names.
    q, promo_error = build_quote(
        vehicle=veh,
        p_date=pickup_date,
        r_date=return_date,
        addons=addons,
        one_way_fee=one_way_fee,
        pickup_time=pickup_time or b.pickup_time,
        return_time=return_time or b.return_time,
        promo_code=(b.pricing_snapshot or {}).get('promo_code'),
        user=b.customer,
    )

    new_total = Decimal(str(q['grand_total']))
    old_total = Decimal(str(b.total_amount))

    delta = new_total - old_total

    free = timezone.now() <= (
        _pickup_dt(b) - timedelta(hours=_free_window_hours())
    )

    fee = (
        Decimal('0')
        if free
        else Decimal(str(get_config('modification_fee', 0)))
    )

    return {
        'available': q.get('available', True),
        'new_total': new_total,
        'old_total': old_total,
        'delta': delta,
        'modification_fee': fee,
        'amount_due_now': max(delta, Decimal('0')) + fee,
        'refund_due': max(-delta - fee, Decimal('0')),
        'free_window': free,
        'is_upgrade': vehicle is not None and vehicle.pk != b.vehicle_id,
        'quote': q,
        'promo_error': promo_error,
    }

@transaction.atomic
def apply_modification(booking_id, *, customer_user, pickup_date, return_date,
                       pickup_time=None, return_time=None, vehicle=None,
                       return_city=None, request=None):
    """
    Commits the change. If extra money is due, the booking stays on its OLD
    dates until the top-up payment is verified: we store a pending_modification
    JSON and PaymentService._apply() finalises it. If nothing is due (or a refund
    is), it is applied immediately.
    """
    b = Booking.objects.select_for_update().get(pk=booking_id)
    if b.customer_id != customer_user.id:
        raise LifecycleError('Not your booking.')
    if b.status != 'CONFIRMED':
        raise LifecycleError('Only confirmed bookings can be modified.')
    if _pickup_dt(b) <= timezone.now():
        raise LifecycleError('Pickup time has passed.')
    if b.modification_count >= int(get_config('max_modifications', 2)):
        raise LifecycleError('Modification limit reached.')

    q = quote_modification(b, pickup_date=pickup_date, return_date=return_date,
                           pickup_time=pickup_time, return_time=return_time,
                           vehicle=vehicle, return_city=return_city)
    if not q['available']:
        raise LifecycleError('Not available for the selected dates/vehicle.')

    if q['amount_due_now'] > 0:
        b.pending_modification = {
            'pickup_date': str(pickup_date), 'return_date': str(return_date),
            'pickup_time': str(pickup_time or ''), 'return_time': str(return_time or ''),
            'vehicle_id': (vehicle or b.vehicle).pk,
            'new_total': str(q['new_total']), 'amount_due': str(q['amount_due_now']),
        }
        b.save(update_fields=['pending_modification'])
        return {'status': 'payment_required', 'amount_due': q['amount_due_now'], 'booking': b}

    _commit(b, q, pickup_date, return_date, pickup_time, return_time, vehicle,
            actor=customer_user, request=request)
    return {'status': 'applied', 'refund_due': q['refund_due'], 'booking': b}


def _commit(b, q, pickup_date, return_date, pickup_time, return_time, vehicle, *, actor, request):
    old = {'pickup_date': b.pickup_date, 'return_date': b.return_date,
           'vehicle': b.vehicle_id, 'total_amount': b.total_amount}
    veh = vehicle or b.vehicle
    if veh.pk != b.vehicle_id or pickup_date != b.pickup_date or return_date != b.return_date:
        _ensure_available(b, pickup_date, return_date, vehicle=veh)
        release_dates(b)
    b.vehicle = veh
    b.vendor = veh.vendor                 # upgrade to another vendor's car moves the booking too
    b.pickup_date, b.return_date = pickup_date, return_date
    b.pickup_time = pickup_time or b.pickup_time
    b.return_time = return_time or b.return_time
    b.total_amount = q['new_total']
    b.modification_count += 1
    b.pending_modification = None
    b.save()
    block_dates(b)
    log_activity(action='upgrade' if q['is_upgrade'] else 'update', module='booking',
                 request=request, actor=actor, entity=b,
                 summary=f'Booking {b.pk} modified (delta ₹{q["delta"]})',
                 old=old, new={'pickup_date': b.pickup_date, 'return_date': b.return_date,
                               'vehicle': b.vehicle_id, 'total_amount': b.total_amount})


def finalize_pending_modification(b, *, actor=None, request=None):
    """Called from PaymentService._apply() (already inside its row lock) once top-up is paid."""
    pm = b.pending_modification
    if not pm:
        return
    from apps.vehicles.models import Vehicle
    veh = Vehicle.objects.get(pk=pm['vehicle_id'])
    pd = datetime.strptime(pm['pickup_date'], '%Y-%m-%d').date()
    rd = datetime.strptime(pm['return_date'], '%Y-%m-%d').date()
    q = {'new_total': Decimal(pm['new_total']), 'delta': Decimal(pm['amount_due']),
         'is_upgrade': veh.pk != b.vehicle_id}
    _commit(b, q, pd, rd, None, None, veh, actor=actor or b.customer, request=request)


def _validate_dates(pickup_date, return_date):
    if not pickup_date or not return_date:
        raise LifecycleError('Pickup and return dates are required.')
    if return_date < pickup_date:
        raise LifecycleError('Return date cannot be before pickup date.')
    if pickup_date < timezone.localdate():
        raise LifecycleError('Pickup date cannot be in the past.')


def _ensure_available(b, pickup_date, return_date, vehicle=None):
    veh = vehicle or b.vehicle
    qs = VehicleAvailability.objects.select_for_update().filter(
        vehicle=veh, blocked_date__gte=pickup_date, blocked_date__lte=return_date)
    if veh.pk == b.vehicle_id:
        qs = qs.exclude(reason='booking', booking_ref=b.booking_ref)  # own dates don't clash
    if qs.exists():
        raise LifecycleError('Vehicle is not available for those dates.')
