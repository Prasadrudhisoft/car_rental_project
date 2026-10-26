import datetime
from decimal import Decimal, ROUND_HALF_UP

from apps.configuration.utils import get_config, get_segment_config

CENT = Decimal('0.01')

ADDON_PRICES = {
    'insurance_basic':         Decimal('299'),
    'insurance_comprehensive': Decimal('599'),
    'personal_accident':       Decimal('199'),
    'child_seat':              Decimal('149'),
    'gps':                     Decimal('99'),
    'additional_driver':       Decimal('249'),
}


def _q(x):
    return Decimal(x).quantize(CENT, ROUND_HALF_UP)


def get_addon_price(addon_type: str) -> Decimal:
    return ADDON_PRICES.get(addon_type, Decimal('0'))


def clean_addons(addons) -> list:
    """Known add-ons only, de-duplicated (a tampered request can't double-charge or inject types)."""
    return list(dict.fromkeys(a for a in (addons or []) if a in ADDON_PRICES))


def one_way_fee_for(from_city_id, to_city_id) -> Decimal:
    """Server-side one-way fee. Never trust a client-sent fee."""
    from apps.locations.models import CityPairFee
    if not from_city_id or not to_city_id or int(from_city_id) == int(to_city_id):
        return Decimal('0')
    pair = CityPairFee.objects.filter(
        from_city_id=from_city_id, to_city_id=to_city_id, is_active=True).first()
    return pair.fee if pair else Decimal('0')


def calculate_price(vehicle_segment, daily_rate, rental_days=0, selected_addons=None,
                    one_way_fee=Decimal('0'), pickup_time=None, return_time=None,
                    discount=Decimal('0')) -> dict:
    """
    subtotal = base + add-ons + one-way fee           (pre-tax)
    taxable  = subtotal - discount                     (promo reduces the taxable amount)
    GST      = taxable x gst_rate  (split CGST/SGST)
    total    = taxable + GST                           (the amount the customer is charged)
    Every component is rounded to paise BEFORE summing, so lines always add up to the total.
    """
    daily_rate  = Decimal(str(daily_rate))
    one_way_fee = _q(Decimal(str(one_way_fee or 0)))
    addons      = clean_addons(selected_addons)
    days        = max(rental_days, 1)

    gst_rate = Decimal(str(get_config('gst_rate', '0.18')))
    seg      = get_segment_config(vehicle_segment)

    if pickup_time and return_time and rental_days >= 0:
        base = _calculate_time_based(daily_rate, rental_days, pickup_time, return_time)
    else:
        base = daily_rate * Decimal(days)
    base_amount = _q(base)
    addon_total = _q(sum((ADDON_PRICES[a] * days for a in addons), Decimal('0')))

    subtotal = base_amount + addon_total + one_way_fee
    discount = _q(min(max(Decimal(str(discount or 0)), Decimal('0')), subtotal))
    taxable  = subtotal - discount

    gst_amount  = _q(taxable * gst_rate)
    cgst        = _q(gst_amount / 2)
    sgst        = gst_amount - cgst
    grand_total = taxable + gst_amount

    from .payments import payment_schedule
    sched = payment_schedule(grand_total)

    return {
        'daily_rate':       str(daily_rate),
        'rental_days':      rental_days,
        'selected_addons':  addons,
        'base_amount':      str(base_amount),
        'addon_total':      str(addon_total),
        'one_way_fee':      str(one_way_fee),
        'subtotal':         str(subtotal),
        'promo_code':       None,
        'discount_amount':  str(discount),
        'taxable_amount':   str(taxable),
        'gst_rate':         str(gst_rate),
        'gst_amount':       str(gst_amount),
        'cgst_amount':      str(cgst),
        'sgst_amount':      str(sgst),
        'grand_total':      str(grand_total),
        'security_deposit': str(seg.get('security_deposit', Decimal('0'))),
        'advance_pct':      sched['advance_pct'],
        'advance_amount':   str(sched['advance']),
        'remaining_amount': str(sched['remaining']),
        'min_rental_days':  seg.get('min_rental_days', 1),
        'min_driver_age':   seg.get('min_driver_age', 21),
        'cancellation_free_hours':        get_config('cancellation_free_hours', 48),
        'cancellation_half_refund_hours': get_config('cancellation_half_refund_hours', 24),
    }


def build_quote(vehicle, p_date, r_date, addons, one_way_fee, pickup_time, return_time,
                promo_code=None, user=None):
    """
    THE pricing entry point (preview and booking creation both call this).
    Returns (quote, promo_error). A bad promo never raises: the quote is returned WITHOUT the
    discount and promo_error explains why, so callers decide whether to block.
    """
    from apps.promotions.service import PromoError, evaluate_promo

    kw = dict(vehicle_segment=vehicle.segment, daily_rate=vehicle.daily_rate,
              rental_days=(r_date - p_date).days, selected_addons=addons,
              one_way_fee=one_way_fee, pickup_time=pickup_time, return_time=return_time)
    quote = calculate_price(**kw)

    code = (promo_code or '').strip().upper()
    promo_error = None
    if code:
        try:
            if user is None or not getattr(user, 'is_authenticated', False):
                raise PromoError('Sign in to apply a promo code.')
            promo, discount = evaluate_promo(code, user, Decimal(quote['subtotal']))
            quote = calculate_price(**kw, discount=discount)
            quote['promo_code'] = promo.code
        except PromoError as exc:
            promo_error = str(exc)
    return quote, promo_error


def _calculate_time_based(daily_rate: Decimal, rental_days: int, pickup_time: str, return_time: str) -> Decimal:
    """Hybrid daily + hourly: full first day, full middle days, last day = 50% + 50%/24 per hour."""
    try:
        pt = datetime.time(*[int(x) for x in pickup_time.split(':')])
        rt = datetime.time(*[int(x) for x in return_time.split(':')])
    except Exception:
        return daily_rate * Decimal(max(rental_days, 1))

    half_rate   = daily_rate * Decimal('0.5')
    hourly_rate = half_rate / Decimal('24')

    if rental_days <= 1:
        return daily_rate

    total = daily_rate
    middle = rental_days - 2
    if middle > 0:
        total += daily_rate * Decimal(middle)

    minutes = rt.hour * 60 + rt.minute
    hours = Decimal('24') if minutes == 0 else Decimal(minutes) / Decimal('60')
    return total + half_rate + hourly_rate * hours