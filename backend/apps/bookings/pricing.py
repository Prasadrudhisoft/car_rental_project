from decimal import Decimal, ROUND_HALF_UP
from apps.configuration.utils import get_config, get_segment_config


ADDON_PRICES = {
    'insurance_basic':         Decimal('299'),
    'insurance_comprehensive': Decimal('599'),
    'personal_accident':       Decimal('199'),
    'child_seat':              Decimal('149'),
    'gps':                     Decimal('99'),
    'additional_driver':       Decimal('249'),
}


def get_addon_price(addon_type: str) -> Decimal:
    return ADDON_PRICES.get(addon_type, Decimal('0'))


def calculate_price(
    vehicle_segment: str,
    daily_rate: Decimal,
    rental_days: int = 0,
    selected_addons: list = None,
    one_way_fee: Decimal = Decimal('0'),
    pickup_time: str = None,   # "HH:MM"
    return_time: str = None,   # "HH:MM"
) -> dict:
    """
    Core pricing function.

    Rental calculation logic:
    ─────────────────────────
    • Day 1 (any return on the day after pickup) = 1 full day charge.
    • For each additional day beyond the first:
        base_charge   = daily_rate × 50%
        hourly_charge = (daily_rate × 50%) / 24 × hours_used_that_day
        day_cost      = base_charge + hourly_charge

    When pickup_time and return_time are provided, the calculation uses
    actual hours for the fractional last day.
    When they are not provided, integer rental_days is used (legacy path).
    """
    daily_rate    = Decimal(str(daily_rate))
    one_way_fee   = Decimal(str(one_way_fee))
    selected_addons = selected_addons or []

    gst_rate = Decimal(str(get_config('gst_rate', '0.18')))
    seg_cfg       = get_segment_config(vehicle_segment)
    deposit       = seg_cfg.get('security_deposit', Decimal('0'))

    # ── Time-aware calculation ──────────────────────────
    if pickup_time and return_time and rental_days >= 0:
        base_amount = _calculate_time_based(daily_rate, rental_days, pickup_time, return_time)
    else:
        # Legacy: integer days only
        base_amount = daily_rate * Decimal(str(max(rental_days, 1)))

    # ── Add-ons ─────────────────────────────────────────
    addon_total = sum((get_addon_price(a) * Decimal(str(max(rental_days, 1))) for a in selected_addons),Decimal('0') )

    # ── GST ─────────────────────────────────────────────
    taxable     = base_amount + addon_total + one_way_fee
    gst_amount  = (taxable * Decimal(str(gst_rate))).quantize(Decimal('0.01'), ROUND_HALF_UP)
    cgst        = (gst_amount / 2).quantize(Decimal('0.01'), ROUND_HALF_UP)
    sgst        = gst_amount - cgst
    grand_total = taxable + gst_amount

    return {
        'daily_rate':       str(daily_rate),
        'rental_days':      rental_days,
        'base_amount':      str(base_amount.quantize(Decimal('0.01'), ROUND_HALF_UP)),
        'addon_total':      str(addon_total.quantize(Decimal('0.01'), ROUND_HALF_UP)),
        'one_way_fee':      str(one_way_fee),
        'gst_rate':         str(gst_rate),
        'gst_amount':       str(gst_amount),
        'cgst_amount':      str(cgst),
        'sgst_amount':      str(sgst),
        'grand_total':      str(grand_total.quantize(Decimal('0.01'), ROUND_HALF_UP)),
        'security_deposit': str(deposit),
    }


def _calculate_time_based(daily_rate: Decimal, rental_days: int,
                           pickup_time: str, return_time: str) -> Decimal:
    """
    Implements the hybrid daily + hourly formula:

    Day 1 (first overnight):  full daily_rate
    Day N (N > 1):
        cost = (daily_rate × 0.50) + (daily_rate × 0.50 / 24 × hours_on_that_day)

    pickup_time and return_time are "HH:MM" strings.
    rental_days = (return_date - pickup_date).days  — integer, always ≥ 1
    """
    import datetime

    try:
        pt = datetime.time(*[int(x) for x in pickup_time.split(':')])
        rt = datetime.time(*[int(x) for x in return_time.split(':')])
    except Exception:
        # Fallback: full-day pricing
        return daily_rate * Decimal(str(rental_days))

    half_rate    = daily_rate * Decimal('0.5')
    hourly_rate  = half_rate / Decimal('24')

    if rental_days <= 1:
        # Pickup and return on consecutive days (or same day) = 1 full day
        return daily_rate

    # First full day
    total = daily_rate

    # Middle full days (days 2 through N-1)
    full_middle_days = rental_days - 2  # days between first and last
    if full_middle_days > 0:
        total += daily_rate * Decimal(str(full_middle_days))

    # Last partial day: count hours from midnight (00:00) until return_time
    last_day_minutes = rt.hour * 60 + rt.minute
    last_day_hours   = Decimal(str(last_day_minutes)) / Decimal('60')

    # If return time is exactly midnight (00:00), it counts as the full previous day
    if last_day_minutes == 0:
        last_day_hours = Decimal('24')

    last_day_cost = half_rate + (hourly_rate * last_day_hours)
    total += last_day_cost

    return total