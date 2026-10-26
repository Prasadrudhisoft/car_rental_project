from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone

from .models import PromoCode, PromoUsed

CENT = Decimal('0.01')


class PromoError(Exception):
    """User-facing promo problem (message is safe to show)."""


def _usages(promo):
    # a cancelled booking releases its redemption (failed payment, cancellation)
    return PromoUsed.objects.filter(promo=promo).exclude(booking__status='CANCELLED')


def active_redemptions(promo):
    return _usages(promo).count()


def compute_discount(promo, subtotal):
    subtotal = Decimal(subtotal)
    if promo.discount_type == 'flat':
        d = promo.discount_value
    else:
        d = subtotal * promo.discount_value / Decimal('100')
        if promo.max_discount_cap:
            d = min(d, promo.max_discount_cap)
    return min(d, subtotal).quantize(CENT, ROUND_HALF_UP)


def evaluate_promo(code, user, subtotal, promo=None):
    """Validate `code` against the PRE-TAX subtotal. Returns (promo, discount) or raises PromoError."""
    code = (code or '').strip().upper()
    if not code:
        raise PromoError('Enter a promo code.')
    promo = promo or PromoCode.objects.filter(code__iexact=code, is_active=True).first()
    if not promo:
        raise PromoError('Invalid promo code.')

    now = timezone.now()
    if now < promo.valid_from:
        raise PromoError('This promo code is not active yet.')
    if now > promo.valid_until:
        raise PromoError('This promo code has expired.')
    if Decimal(subtotal) < promo.min_booking_value:
        raise PromoError(f'Minimum booking value for this code is ₹{promo.min_booking_value} (before tax).')

    usages = _usages(promo)
    if promo.is_single_use and usages.filter(user=user).exists():
        raise PromoError('You have already used this promo code.')
    if promo.max_redemptions is not None and usages.count() >= promo.max_redemptions:
        raise PromoError('This promo code is no longer available.')

    discount = compute_discount(promo, subtotal)
    if discount <= 0:
        raise PromoError('This promo code gives no discount on this booking.')
    return promo, discount


def redeem_promo(code, user, booking, subtotal, discount):
    """
    Record the redemption. Call INSIDE the booking transaction: the promo row is locked, the
    limits are re-checked and the discount recomputed, so two customers can't take the last use
    and a promo edited mid-checkout can't charge a different amount than was shown.
    """
    promo = PromoCode.objects.select_for_update().filter(code__iexact=code, is_active=True).first()
    if not promo:
        raise PromoError('Invalid promo code.')
    _, fresh = evaluate_promo(code, user, subtotal, promo=promo)
    if fresh != Decimal(discount):
        raise PromoError('This promo code changed while you were checking out. Please review the price.')
    return PromoUsed.objects.create(promo=promo, user=user, booking=booking, discount_applied=fresh)