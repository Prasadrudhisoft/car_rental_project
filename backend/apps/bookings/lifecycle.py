"""
Booking lifecycle.
  A. No-show           : end of pickup date, separate NO_SHOW status + reason.
  B. Modification      : ONE engine (modify_booking) for customer, vendor and admin:
                         dates, vehicle, upgrade, return location.
Every change is atomic, row-locked, availability-checked, re-priced and written to
BookingModification + ActivityLog. A modification is NOT a cancellation.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.activity.services import log_activity
from apps.configuration.utils import get_config, get_segment_config
from apps.locations.models import Location
from apps.logistics.capacity import (ReturnCapacityConflict, network_member_for_location,
                                     release_return_slot, validate_return_location)
from apps.promotions.models import PromoCode, PromoUsed
from apps.promotions.service import compute_discount
from apps.vehicles.models import Vehicle, VehicleAvailability
from car_rent.async_utils import enqueue

from .models import Booking, BookingModification
from .pricing import calculate_price, one_way_fee_for

HOLD_SUFFIX  = '#MOD'
HOLD_MINUTES = 30
_UNSET = object()
ZERO = Decimal('0.00')


class LifecycleError(Exception):
    pass


# ── small helpers ───────────────────────────────────────────────────────────
def _span(a, b):
    return [a + timedelta(days=i) for i in range((b - a).days + 1)]


def _hold_ref(b):
    return f'{b.booking_ref}{HOLD_SUFFIX}'


def _tstr(t):
    if t is None or t == '':
        return None
    return t.strftime('%H:%M') if hasattr(t, 'strftime') else str(t)[:5]


def _to_time(s):
    return datetime.strptime(s, '%H:%M').time() if s else None


def _pickup_dt(b):
    t = b.pickup_time or datetime.min.time()
    return timezone.make_aware(datetime.combine(b.pickup_date, t))


def _pickup_loc(veh):
    return veh.pickup_location or getattr(getattr(veh.vendor, 'vendor_profile', None), 'pickup_location', None)


def _paid(b):
    from .payments import PaymentService
    return PaymentService.amount_paid(b)


def _notify(user, title, message, role_of_user, booking):
    from apps.notifications.utils import notify
    tab = '/vendor' if role_of_user == 'vendor' else '/customer'
    notify(user, title, message, 'system', f'{tab}?tab=bookings&highlight={booking.pk}')


# ── availability ────────────────────────────────────────────────────────────
def block_dates(b):
    for d in _span(b.pickup_date, b.return_date):
        VehicleAvailability.objects.get_or_create(
            vehicle=b.vehicle, blocked_date=d,
            defaults={'reason': 'booking', 'booking_ref': b.booking_ref})


def release_dates(b):
    """Frees every date this booking holds, on ANY vehicle."""
    VehicleAvailability.objects.filter(reason='booking', booking_ref=b.booking_ref).delete()


def release_holds(b):
    VehicleAvailability.objects.filter(reason='booking', booking_ref=_hold_ref(b)).delete()


def _hold(b, veh, pd, rd):
    for d in _span(pd, rd):
        VehicleAvailability.objects.get_or_create(
            vehicle=veh, blocked_date=d,
            defaults={'reason': 'booking', 'booking_ref': _hold_ref(b)})


def _dates_taken(b, veh, pd, rd):
    return (VehicleAvailability.objects
            .filter(vehicle=veh, blocked_date__range=(pd, rd))
            .exclude(booking_ref__in=[b.booking_ref, _hold_ref(b)]).exists())


# ════════════════════════════════════════════════════════════════════════════
# A. NO-SHOW
# ════════════════════════════════════════════════════════════════════════════
def pickup_day_over(b):
    return timezone.localdate() > b.pickup_date


@transaction.atomic
def mark_no_show(booking_id, *, actor=None, request=None, auto=False):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    if b.status != 'CONFIRMED':
        raise LifecycleError('Only confirmed, not-yet-collected bookings can be no-shows.')
    if b.inspections.filter(inspection_type='PICKUP').exists():
        raise LifecycleError('Pickup has already started for this booking.')
    if not pickup_day_over(b):
        raise LifecycleError('A booking can only be marked no-show after its pickup date has ended.')

    discard_pending_modification(b, 'EXPIRED')
    old = {'status': b.status}
    b.status = 'NO_SHOW'
    b.no_show_at = timezone.now()
    b.no_show_reason = ('Customer did not collect the vehicle on the scheduled pickup date'
                        + (' (auto-detected).' if auto else f' (marked by {getattr(actor, "email", "vendor")}).'))
    b.save(update_fields=['status', 'no_show_at', 'no_show_reason', 'updated_at'])
    release_dates(b)           # vehicle is bookable again (the pickup day itself is already past)
    release_return_slot(b)     # free the one-way drop slot, if any
    log_activity(action='no_show', module='booking', request=request, actor=actor, entity=b,
                 summary=f'Booking {b.pk} marked no-show' + (' (auto)' if auto else ''),
                 old=old, new={'status': 'NO_SHOW', 'amount_retained': str(_paid(b))})
    _notify(b.customer, 'Booking marked as no-show',
            f'{b.booking_ref} was not collected on {b.pickup_date}. The advance is retained as per policy.',
            'customer', b)
    return b


# ════════════════════════════════════════════════════════════════════════════
# B. MODIFICATION ENGINE
# ════════════════════════════════════════════════════════════════════════════
def _role(b, actor):
    if actor.id == b.customer_id:
        return 'customer'
    if actor.id == b.vendor_id:
        return 'vendor'
    if getattr(actor, 'role', None) == 'admin':
        return 'admin'
    raise LifecycleError('Not your booking.')


def _check_modifiable(b, role):
    if b.status != 'CONFIRMED':
        raise LifecycleError('Only confirmed bookings can be changed.')
    if b.inspections.filter(inspection_type='PICKUP').exists():
        raise LifecycleError('Pickup has already started, so this booking can no longer be changed.')
    if role == 'customer':
        if _pickup_dt(b) <= timezone.now():
            raise LifecycleError('Pickup time has passed.')
        if b.modification_count >= int(get_config('max_modifications', 2)):
            raise LifecycleError('Modification limit reached.')
    elif pickup_day_over(b):
        raise LifecycleError('The pickup date has passed.')


def _validate_dates(pd, rd):
    if not pd or not rd:
        raise LifecycleError('Pickup and return dates are required.')
    if rd < pd:
        raise LifecycleError('Return date cannot be before pickup date.')
    if pd < timezone.localdate():
        raise LifecycleError('Pickup date cannot be in the past.')


def _state_of(veh, pd, rd, pt, rt, pickup_loc, ret, total):
    return {
        'vehicle_id': veh.pk, 'vehicle': f'{veh.year} {veh.make} {veh.model} ({veh.plate_number})',
        'pickup_date': str(pd), 'return_date': str(rd), 'pickup_time': pt, 'return_time': rt,
        'pickup_location_id': pickup_loc.id, 'pickup_location': pickup_loc.name,
        'return_location_id': ret.id if ret else None, 'return_location': ret.name if ret else '',
        'total_amount': str(total),
    }


def _state(b):
    return _state_of(b.vehicle, b.pickup_date, b.return_date, _tstr(b.pickup_time), _tstr(b.return_time),
                     b.pickup_location, b.return_location, b.total_amount)


def _price(b, veh, pd, rd, pt, rt, one_way_fee):
    """Same maths as booking creation. An already-redeemed promo is re-applied, not re-validated."""
    kw = dict(vehicle_segment=veh.segment, daily_rate=veh.daily_rate, rental_days=(rd - pd).days,
              selected_addons=[a.addon_type for a in b.addons.all()], one_way_fee=one_way_fee,
              pickup_time=pt, return_time=rt)
    q = calculate_price(**kw)
    code = (b.pricing_snapshot or {}).get('promo_code')
    if code:
        promo = PromoCode.objects.filter(code__iexact=code).first()
        if promo and Decimal(q['subtotal']) >= promo.min_booking_value:
            q = calculate_price(**kw, discount=compute_discount(promo, Decimal(q['subtotal'])))
            q['promo_code'] = promo.code
    return q


def _plan(b, role, *, pickup_date=None, return_date=None, pickup_time=None, return_time=None,
          vehicle=None, return_location=_UNSET, lock=False):
    """Validate + price a change. Pure (no writes) unless lock=True (needs an open transaction)."""
    _check_modifiable(b, role)
    pd, rd = pickup_date or b.pickup_date, return_date or b.return_date
    _validate_dates(pd, rd)

    veh = vehicle or b.vehicle
    if veh.pk != b.vehicle_id:
        if veh.status != 'LIVE' or veh.is_blacklisted:
            raise LifecycleError('That vehicle is not available.')
        if role == 'vendor' and veh.vendor_id != b.vendor_id:
            raise LifecycleError('You can only assign your own vehicles.')
    if lock:
        Vehicle.objects.select_for_update().only('id').get(pk=veh.pk)

    pickup_loc = _pickup_loc(veh)
    if pickup_loc is None:
        raise LifecycleError('That vehicle has no pickup location configured.')
    if pickup_loc.city_id != b.pickup_location.city_id and role != 'admin':
        raise LifecycleError('That vehicle is in a different city.')

    ret = b.return_location if return_location is _UNSET else return_location
    if ret is not None and ret.id == pickup_loc.id:
        ret = None
    if ret is not None:
        if not ret.is_active:
            raise LifecycleError('That return location is not available.')
        if ret.id != b.return_location_id:
            err = validate_return_location(ret, veh.vendor_id)       # capacity + not same vendor
            if err:
                raise LifecycleError(err)
        else:
            m = network_member_for_location(ret.id)
            if m is not None and m.vendor_id == veh.vendor_id:
                raise LifecycleError('Please choose a drop point run by a different vendor.')

    seg = get_segment_config(veh.segment) or {}
    if max((rd - pd).days, 1) < seg.get('min_rental_days', 1):
        raise LifecycleError(f'This vehicle type needs a minimum rental of {seg.get("min_rental_days")} days.')
    dob = getattr(getattr(b.customer, 'customer_profile', None), 'date_of_birth', None)
    if dob:
        t = timezone.localdate()
        age = t.year - dob.year - ((t.month, t.day) < (dob.month, dob.day))
        if age < seg.get('min_driver_age', 21):
            raise LifecycleError(f'The driver must be at least {seg.get("min_driver_age", 21)} for this vehicle.')

    if _dates_taken(b, veh, pd, rd):
        raise LifecycleError('That vehicle is not available for the selected dates.')

    pt = _tstr(pickup_time) or _tstr(b.pickup_time)
    rt = _tstr(return_time) or _tstr(b.return_time)
    q = _price(b, veh, pd, rd, pt, rt,
               one_way_fee_for(pickup_loc.city_id, ret.city_id if ret else None))

    kinds = []
    if (pd, rd) != (b.pickup_date, b.return_date) or pt != _tstr(b.pickup_time) or rt != _tstr(b.return_time):
        kinds.append('dates')
    if veh.pk != b.vehicle_id:
        kinds.append('vehicle')
        if Decimal(veh.daily_rate) > Decimal(b.vehicle.daily_rate):
            kinds.append('upgrade')
    if pickup_loc.id != b.pickup_location_id:
        kinds.append('pickup_location')
    if (ret.id if ret else None) != b.return_location_id:
        kinds.append('return_location')

    # ── money ───────────────────────────────────────────────────────────────
    old_total, new_total = Decimal(b.total_amount), Decimal(q['grand_total'])
    delta = new_total - old_total
    free = timezone.now() <= _pickup_dt(b) - timedelta(hours=int(get_config('cancellation_free_hours', 48)))
    fee = (Decimal(str(get_config('modification_fee', 0))).quantize(Decimal('0.01'))
           if (role == 'customer' and 'dates' in kinds and not free) else ZERO)
    prior_fees = Decimal(str((b.pricing_snapshot or {}).get('modification_fee_total', '0')))
    if delta > 0:
        due, refund = delta + fee, ZERO
    else:
        over = _paid(b) - (new_total + prior_fees)
        refund = max(over - fee, ZERO)
        due = max(fee - max(over, ZERO), ZERO)

    return dict(veh=veh, pd=pd, rd=rd, ptime=pt, rtime=rt, pickup_loc=pickup_loc, ret=ret, quote=q,
                kinds=kinds, old=_state(b), new=_state_of(veh, pd, rd, pt, rt, pickup_loc, ret, new_total),
                old_total=old_total, new_total=new_total, delta=delta, fee=fee, due=due,
                refund=refund, free=free)


def quote_modification(b, actor, **kw):
    return _plan(b, _role(b, actor), **kw)


def vehicle_options(b, actor, pickup_date=None, return_date=None, limit=30):
    """Alternative vehicles for the (new) dates, each already priced against this booking."""
    role = _role(b, actor)
    _check_modifiable(b, role)
    pd, rd = pickup_date or b.pickup_date, return_date or b.return_date
    _validate_dates(pd, rd)
    taken = (VehicleAvailability.objects.filter(blocked_date__range=(pd, rd))
             .exclude(booking_ref__in=[b.booking_ref, _hold_ref(b)]).values_list('vehicle_id', flat=True))
    qs = (Vehicle.objects.filter(status='LIVE', is_blacklisted=False,
                                 current_city_id=b.pickup_location.city_id)
          .exclude(pk=b.vehicle_id).exclude(pk__in=taken)
          .select_related('vendor__vendor_profile', 'pickup_location').order_by('daily_rate'))
    if role == 'vendor':
        qs = qs.filter(vendor_id=b.vendor_id)
    out = []
    for v in qs[:limit]:
        try:
            p = _plan(b, role, pickup_date=pd, return_date=rd, vehicle=v)
        except LifecycleError:
            continue
        out.append({
            'id': v.pk, 'label': f'{v.year} {v.make} {v.model}', 'plate_number': v.plate_number,
            'segment': v.segment, 'fuel_type': v.fuel_type, 'transmission': v.transmission,
            'daily_rate': str(v.daily_rate),
            'vendor_name': getattr(getattr(v.vendor, 'vendor_profile', None), 'business_name', ''),
            'pickup_point': p['pickup_loc'].name,
            'new_total': str(p['new_total']), 'delta': str(p['delta']),
            'amount_due_now': str(p['due']), 'refund_due': str(p['refund']),
            'is_upgrade': 'upgrade' in p['kinds'],
        })
    return out


# ── pack / unpack (stored on the booking while payment is pending) ──────────
def _pack(p):
    return {'vehicle_id': p['veh'].pk, 'pickup_date': str(p['pd']), 'return_date': str(p['rd']),
            'pickup_time': p['ptime'], 'return_time': p['rtime'],
            'return_location_id': p['ret'].id if p['ret'] else None, 'quote': p['quote'],
            'fee': str(p['fee']), 'refund': str(p['refund']),
            'amount_due': str(p['due']), 'new_total': str(p['new_total'])}


def _unpack(d):
    veh = Vehicle.objects.select_related('vendor__vendor_profile', 'pickup_location').get(pk=d['vehicle_id'])
    ret = Location.objects.filter(pk=d['return_location_id']).first() if d.get('return_location_id') else None
    return dict(veh=veh, pd=date.fromisoformat(d['pickup_date']), rd=date.fromisoformat(d['return_date']),
                ptime=d.get('pickup_time'), rtime=d.get('return_time'), pickup_loc=_pickup_loc(veh), ret=ret,
                quote=d['quote'], fee=Decimal(d['fee']), refund=Decimal(d['refund']))


_KEEP = ('payments', 'advance_paid', 'remaining_paid', 'full_payment_paid', 'last_payment_method',
         'last_payment_type', 'pending_payment')


def _merge_snapshot(old, quote, fee, refund):
    """New price snapshot, keeping the payment ledger and flags."""
    snap = dict(quote)
    for k in _KEEP:
        if k in old:
            snap[k] = old[k]
    snap['modification_fee_total'] = str(Decimal(str(old.get('modification_fee_total', '0'))) + fee)
    snap['refunded_total'] = str(Decimal(str(old.get('refunded_total', '0'))) + refund)
    return snap


# ── apply ───────────────────────────────────────────────────────────────────
@transaction.atomic
def modify_booking(booking_id, *, actor, request=None, reason='', **kw):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    role = _role(b, actor)
    if role != 'customer' and not (reason or '').strip():
        raise LifecycleError('A reason is required.')
    discard_pending_modification(b, 'EXPIRED')            # a new request supersedes an unpaid one
    p = _plan(b, role, lock=True, **kw)
    if not p['kinds']:
        raise LifecycleError('Nothing to change.')

    mod = BookingModification.objects.create(
        booking=b, initiated_by=actor, initiator_role=role, change_types=p['kinds'],
        reason=reason or '', old_values=p['old'], new_values=p['new'],
        old_total=p['old_total'], new_total=p['new_total'], price_delta=p['delta'],
        modification_fee=p['fee'], amount_due=p['due'], refund_due=p['refund'])

    if p['due'] > 0:                                       # hold the new dates until it is paid
        _hold(b, p['veh'], p['pd'], p['rd'])
        b.pending_modification = {**_pack(p), 'modification_id': mod.pk,
                                  'expires_at': (timezone.now() + timedelta(minutes=HOLD_MINUTES)).isoformat()}
        b.save(update_fields=['pending_modification', 'updated_at'])
        if role != 'customer':
            _notify(b.customer, 'Payment needed for your booking change',
                    f'{b.booking_ref}: pay ₹{p["due"]} within {HOLD_MINUTES} minutes to confirm the change.',
                    'customer', b)
        return {'status': 'payment_required', 'amount_due': p['due'], 'modification': mod, 'booking': b}

    try:
        _commit(b, _pack_to_plan(p), mod, actor=actor, role=role, request=request)
    except ReturnCapacityConflict as exc:
        raise LifecycleError(str(exc) or 'The drop point is no longer available.')
    return {'status': 'applied', 'refund_due': p['refund'], 'modification': mod, 'booking': b}


def _pack_to_plan(p):
    return dict(veh=p['veh'], pd=p['pd'], rd=p['rd'], ptime=p['ptime'], rtime=p['rtime'],
                pickup_loc=p['pickup_loc'], ret=p['ret'], quote=p['quote'], fee=p['fee'], refund=p['refund'])


def _commit(b, d, mod, *, actor, role, request=None, payment_ref=''):
    veh, q = d['veh'], d['quote']
    if _dates_taken(b, veh, d['pd'], d['rd']):             # last line of defence
        raise LifecycleError('That vehicle is no longer available for those dates.')
    release_dates(b)
    release_holds(b)

    b.vehicle, b.vendor = veh, veh.vendor
    b.pickup_date, b.return_date = d['pd'], d['rd']
    b.pickup_time, b.return_time = _to_time(d['ptime']), _to_time(d['rtime'])
    b.pickup_location, b.return_location = d['pickup_loc'], d['ret']
    b.is_one_way = d['ret'] is not None
    b.total_amount = Decimal(q['grand_total'])
    b.deposit_amount = Decimal(q['security_deposit'])
    b.pricing_snapshot = _merge_snapshot(b.pricing_snapshot or {}, q, d['fee'], d['refund'])
    b.pending_modification = None
    if role == 'customer':
        b.modification_count += 1
    elif 'dates' in mod.change_types:
        b.vendor_rescheduled = True                        # customer keeps the full-refund cancel right
        b.reschedule_reason = mod.reason
    b.save()
    block_dates(b)

    release_return_slot(b)                                 # old drop slot (EXPECTED handovers only)
    if b.is_one_way:
        from apps.logistics.views import auto_match_return_partner
        auto_match_return_partner(b)                       # may raise ReturnCapacityConflict

    if q.get('promo_code'):
        PromoUsed.objects.filter(booking=b).update(discount_applied=Decimal(q['discount_amount']))

    mod.status, mod.applied_at, mod.payment_ref = 'APPLIED', timezone.now(), payment_ref
    mod.save(update_fields=['status', 'applied_at', 'payment_ref'])

    if d['refund'] > 0:
        from . import tasks as booking_tasks
        enqueue(booking_tasks.issue_razorpay_refund, b.id, str(d['refund']))

    kinds = mod.change_types
    action = 'upgrade' if 'upgrade' in kinds else ('reschedule' if kinds == ['dates'] and role != 'customer' else 'update')
    log_activity(action=action, module='booking', request=request, actor=actor, entity=b,
                 summary=f'Booking {b.pk} modified by {role}: {", ".join(kinds)} (Δ ₹{mod.price_delta})',
                 old=mod.old_values, new=mod.new_values)

    other, other_role = (b.vendor, 'vendor') if role == 'customer' else (b.customer, 'customer')
    _notify(other, 'Booking changed', f'{b.booking_ref} was updated ({", ".join(kinds)}).', other_role, b)
    return b


def finalize_pending_modification(b, *, actor=None, request=None, payment_ref=''):
    """Called by PaymentService once the top-up is recorded (inside its own transaction)."""
    pm = b.pending_modification
    if not pm:
        return None
    mod = BookingModification.objects.select_for_update().get(pk=pm['modification_id'])
    _commit(b, _unpack(pm), mod, actor=actor or mod.initiated_by or b.customer,
            role=mod.initiator_role, request=request, payment_ref=payment_ref)
    return mod


# ── pending-modification housekeeping ───────────────────────────────────────
def discard_pending_modification(b, status='EXPIRED'):
    pm = b.pending_modification
    if not pm:
        return
    release_holds(b)
    BookingModification.objects.filter(pk=pm.get('modification_id'), status='PENDING_PAYMENT').update(status=status)
    b.pending_modification = None
    b.save(update_fields=['pending_modification', 'updated_at'])


@transaction.atomic
def expire_pending_modification(booking_id):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    pm = b.pending_modification
    if pm and pm.get('expires_at') and timezone.now() > datetime.fromisoformat(pm['expires_at']):
        discard_pending_modification(b, 'EXPIRED')
        return True
    return False


@transaction.atomic
def fail_pending_modification(booking_id):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    discard_pending_modification(b, 'FAILED')