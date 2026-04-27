from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
 
User = get_user_model()
 
 
class Review(models.Model):
    """
    One row = one customer review after a completed booking.
    SQL table: reviews_review
    One review per booking maximum (enforced by unique_together).
    """
    booking  = models.OneToOneField(
        'bookings.Booking', on_delete=models.CASCADE, related_name='review')
    customer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='reviews_given',
        limit_choices_to={'role': 'customer'})
    vendor   = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='reviews_received',
        limit_choices_to={'role': 'vendor'})
    vehicle  = models.ForeignKey(
        'vehicles.Vehicle', on_delete=models.CASCADE, related_name='reviews')
 
    vendor_rating  = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)])
    vehicle_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)])
    review_text    = models.TextField(blank=True)
    is_visible     = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'reviews_review'
        ordering = ['-created_at']
 
    def __str__(self):
        return f'Review by {self.customer.full_name} — Vendor {self.vendor_rating}★'
 
 
class VendorRatingSnapshot(models.Model):
    """
    Pre-computed vendor rating stored for fast lookups.
    SQL table: reviews_vendorratingsnapshot
    Recalculated every time a new review is submitted.
    One row per vendor (OneToOne).
    """
    vendor          = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='rating_snapshot',
        limit_choices_to={'role': 'vendor'})
    weighted_score  = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews   = models.PositiveIntegerField(default=0)
    is_flagged      = models.BooleanField(default=False)
    last_updated    = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'reviews_vendorratingsnapshot'
 
    def __str__(self):
        return f'{self.vendor.full_name} — {self.weighted_score}★'
