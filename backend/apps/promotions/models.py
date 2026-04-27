from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class PromoCode(models.Model):
    """
    One row = one promotional code.
    SQL table: promotions_promocode
    """
    DISCOUNT_TYPES = [
        ('flat',       'Flat INR discount'),
        ('percentage', 'Percentage discount'),
    ]
 
    code             = models.CharField(max_length=30, unique=True)
    description      = models.CharField(max_length=200, blank=True)
    discount_type    = models.CharField(max_length=12, choices=DISCOUNT_TYPES)
    discount_value   = models.DecimalField(max_digits=8, decimal_places=2)
    max_discount_cap = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="For percentage type: cap the max INR discount. Leave blank for no cap.",
    )
    min_booking_value = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Booking total must be at least this amount for the code to apply.",
    )
    is_single_use    = models.BooleanField(
        default=False,
        help_text="If True, each customer can only use this code once.",
    )
    max_redemptions  = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Total number of times this code can be used across all customers. Leave blank for unlimited.",
    )
    valid_from       = models.DateTimeField()
    valid_until      = models.DateTimeField()
    is_active        = models.BooleanField(default=True)
    created_by       = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        limit_choices_to={'role': 'admin'},
    )
    created_at       = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'promotions_promocode'
 
    def __str__(self):
        return f'{self.code} ({self.discount_type}: {self.discount_value})'
 
 
class PromoUsed(models.Model):
    """
    Records which customer used which promo code on which booking.
    SQL table: promotions_promoused
    Prevents single-use codes from being reused.
    """
    promo   = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name="usages")
    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name="promos_used")
    booking = models.ForeignKey(
        'bookings.Booking', on_delete=models.CASCADE, related_name='promo_usage',
        null=True, blank=True)
    used_at = models.DateTimeField(auto_now_add=True)
    discount_applied = models.DecimalField(max_digits=8, decimal_places=2)
 
    class Meta:
        db_table = 'promotions_promoused'
