from datetime import timedelta
from decimal import Decimal
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.bookings.payments import PaymentService, payment_schedule
from apps.bookings.pricing import calculate_price
from apps.promotions.models import PromoCode
from apps.promotions.service import PromoError, evaluate_promo
from apps.users.models import User


class PromoPricingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('c@x.com', 'pw12345!', phone='9999999999',
                                             full_name='C', role='customer')
        now = timezone.now()
        self.mk = lambda **k: PromoCode.objects.create(
            code=k.pop('code'), discount_type=k.pop('discount_type', 'percentage'),
            discount_value=k.pop('discount_value', 10), valid_from=now - timedelta(days=1),
            valid_until=k.pop('valid_until', now + timedelta(days=1)), **k)

    def test_percentage_cap_and_tax_on_discounted_amount(self):
        p = self.mk(code='P10', discount_value=50, max_discount_cap=100)
        _, d = evaluate_promo('p10', self.user, Decimal('1000'))
        self.assertEqual(d, Decimal('100.00'))
        q = calculate_price('sedan', 1000, 1, discount=d)
        self.assertEqual(q['taxable_amount'], '900.00')
        self.assertEqual(Decimal(q['grand_total']), Decimal('900.00') + Decimal(q['gst_amount']))
        self.assertEqual(Decimal(q['advance_amount']) + Decimal(q['remaining_amount']), Decimal(q['grand_total']))

    def test_flat_never_exceeds_subtotal(self):
        self.mk(code='BIG', discount_type='flat', discount_value=5000)
        self.assertEqual(evaluate_promo('BIG', self.user, Decimal('800'))[1], Decimal('800.00'))

    def test_errors(self):
        self.mk(code='OLD', valid_until=timezone.now() - timedelta(hours=1))
        self.mk(code='MIN', min_booking_value=2000)
        for code in ('NOPE', 'OLD', 'MIN'):
            with self.assertRaises(PromoError):
                evaluate_promo(code, self.user, Decimal('1000'))


class DummyLockTests(TestCase):
    @override_settings(DEBUG=False, PAYMENT_DUMMY_ENABLED=True)
    def test_dummy_off_when_not_debug(self):
        self.assertFalse(PaymentService.dummy_enabled())

    @override_settings(DEBUG=True, PAYMENT_DUMMY_ENABLED=False)
    def test_dummy_off_when_switch_off(self):
        self.assertFalse(PaymentService.dummy_enabled())

    def test_schedule_adds_up(self):
        s = payment_schedule('1234.57')
        self.assertEqual(s['advance'] + s['remaining'], Decimal('1234.57'))