from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class Booking(models.Model):
    """
    One row = one rental booking.
    SQL table: bookings_booking
 
    The pricing_snapshot field stores a JSON copy of all prices at booking time.
    This is critical: if a vendor changes their daily rate tomorrow, existing
    bookings must still show the original agreed price.
    """
 
    STATUS = [
        ('PENDING',    'Pending Payment'),
        ('CONFIRMED',  'Confirmed'),
        ('ACTIVE',     'Active — Vehicle Picked Up'),
        ('COMPLETED',  'Completed'),
        ('CANCELLED',  'Cancelled'),
    ]
 
    # Core relationships
    customer         = models.ForeignKey(User, on_delete=models.PROTECT,
                                          related_name='bookings_as_customer',
                                          limit_choices_to={'role': 'customer'})
    vehicle          = models.ForeignKey(
        'vehicles.Vehicle', on_delete=models.PROTECT, related_name='bookings')
    vendor           = models.ForeignKey(User, on_delete=models.PROTECT,
                                          related_name='bookings_as_vendor',
                                          limit_choices_to={'role': 'vendor'})
 
    # Dates & locations
    # Dates, times & locations
    pickup_date      = models.DateField()
    pickup_time      = models.TimeField(null=True, blank=True)
    return_date      = models.DateField()
    return_time      = models.TimeField(null=True, blank=True)
    pickup_location  = models.ForeignKey(
        'locations.Location', on_delete=models.PROTECT, related_name='pickups')
    return_location  = models.ForeignKey(
        'locations.Location', on_delete=models.PROTECT, related_name='returns',
        null=True, blank=True)
    is_one_way       = models.BooleanField(default=False)
 
    # Pricing (always read from snapshot, never re-calculated)
    pricing_snapshot = models.JSONField(default=dict)
    total_amount     = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_amount   = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_held     = models.BooleanField(default=False)
    deposit_released = models.BooleanField(default=False)
 
    # Status
    status           = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    cancellation_reason = models.TextField(blank=True)
    cancelled_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                          blank=True, related_name="cancellations")
 
    # Payment (Razorpay)
    razorpay_order_id   = models.CharField(max_length=100, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    payment_captured    = models.BooleanField(default=False)
    payment_captured_at = models.DateTimeField(null=True, blank=True)
 
    # Agreement
    agreement_pdf    = models.FileField(upload_to="agreements/", blank=True, null=True)
    agreement_signed = models.BooleanField(default=False)
    agreement_signed_at = models.DateTimeField(null=True, blank=True)
 
    # Additional driver
    additional_driver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                           blank=True, related_name="additional_driver_bookings")
 
    # Timestamps
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'bookings_booking'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'],             name='bk_status_idx'),
            models.Index(fields=['vendor', 'status'],   name='bk_vendor_status_idx'),
            models.Index(fields=['customer', 'status'], name='bk_cust_status_idx'),
            models.Index(fields=['pickup_date'],        name='bk_pickup_date_idx'),
        ]
 
    def __str__(self):
        return f'BK{self.id:06d} — {self.customer} → {self.vehicle}'
 
    @property
    def booking_ref(self):
        """Human-readable booking reference shown to customers."""
        return f'CRI-{self.id:06d}'
 
    @property
    def rental_days(self):
        return (self.return_date - self.pickup_date).days

    @property
    def rental_hours(self):
        """
        Total rental duration in hours, based on datetime combination.
        Falls back to day-only calculation if times not provided.
        """
        import datetime
        t0 = self.pickup_time or datetime.time(0, 0)
        t1 = self.return_time or datetime.time(0, 0)
        pickup_dt = datetime.datetime.combine(self.pickup_date, t0)
        return_dt = datetime.datetime.combine(self.return_date, t1)
        delta = return_dt - pickup_dt
        return max(0, delta.total_seconds() / 3600)
 
 
class AddOn(models.Model):
    """
    Add-ons selected by customer at booking time.
    SQL table: bookings_addon
    One row per add-on per booking.
    """
    ADDON_TYPES = [
        ('insurance_basic', 'Basic Insurance Cover'),
        ('insurance_comprehensive', 'Comprehensive Insurance'),
        ('personal_accident',       'Personal Accident Cover'),
        ('child_seat',              'Child Seat'),
        ('gps',                     'GPS Device'),
        ('additional_driver',       'Additional Driver'),
    ]
    booking     = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="addons")
    addon_type  = models.CharField(max_length=40, choices=ADDON_TYPES)
    price       = models.DecimalField(max_digits=8, decimal_places=2)
 
    class Meta:
        db_table = 'bookings_addon'
 
 
class InspectionRecord(models.Model):
    """
    Records vehicle condition at pickup and at return.
    SQL table: bookings_inspectionrecord
    PICKUP and RETURN are the two types. Both require OTP sign-off.
    """
    INSPECTION_TYPES = [
        ('PICKUP', 'Pickup Inspection'),
        ('RETURN', 'Return Inspection'),
    ]
    booking          = models.ForeignKey(Booking, on_delete=models.CASCADE,
                                          related_name="inspections")
    inspection_type  = models.CharField(max_length=10, choices=INSPECTION_TYPES)
 
    # Odometer
    odometer_reading = models.PositiveIntegerField()
    fuel_level       = models.CharField(max_length=20, blank=True)
 
    # Condition checklist (stored as JSON: {"exterior": true, "interior": true, ...})
    checklist        = models.JSONField(default=dict)
    notes            = models.TextField(blank=True)
 
    # Damage flag (return inspection only)
    damage_reported  = models.BooleanField(default=False)
    damage_notes     = models.TextField(blank=True)
    damage_amount    = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
 
    # Sign-off (both customer and vendor must sign)
    customer_signed     = models.BooleanField(default=False)
    customer_signed_at  = models.DateTimeField(null=True, blank=True)
    vendor_signed       = models.BooleanField(default=False)
    vendor_signed_at    = models.DateTimeField(null=True, blank=True)
    is_locked           = models.BooleanField(default=False)
 
    created_at       = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'bookings_inspectionrecord'
        unique_together = ['booking', 'inspection_type']
 
 
class InspectionPhoto(models.Model):
    """Photos taken during inspection. SQL table: bookings_inspectionphoto"""
    inspection  = models.ForeignKey(InspectionRecord, on_delete=models.CASCADE,
                                     related_name="photos")
    image       = models.ImageField(upload_to="inspection_photos/")
    angle       = models.CharField(max_length=50, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'bookings_inspectionphoto'
 
 
class Invoice(models.Model):
    """
    GST-compliant invoice generated after return inspection.
    SQL table: bookings_invoice
    """
    booking      = models.OneToOneField(Booking, on_delete=models.CASCADE,
                                         related_name="invoice")
    invoice_ref  = models.CharField(max_length=30, unique=True)
    pdf_file     = models.FileField(upload_to="invoices/", blank=True, null=True)
 
    # Line items mirrored from pricing_snapshot for easy display
    base_amount  = models.DecimalField(max_digits=10, decimal_places=2)
    addon_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    one_way_fee  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cgst_amount  = models.DecimalField(max_digits=10, decimal_places=2)
    sgst_amount  = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_status = models.CharField(max_length=20, default="held")
 
    created_at   = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'bookings_invoice'
 
    def __str__(self):
        return f'INV-{self.invoice_ref}'
 
 
class PaymentEvent(models.Model):
    """
    Audit log of every Razorpay event received.
    SQL table: bookings_paymentevent
    Idempotency: each Razorpay event_id is stored once.
    """
    booking       = models.ForeignKey(Booking, on_delete=models.CASCADE,
                                       related_name="payment_events")
    razorpay_event_id = models.CharField(max_length=100, unique=True)
    event_type    = models.CharField(max_length=50)
    payload       = models.JSONField()
    processed_at  = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'bookings_paymentevent'

class PushSubscription(models.Model):
    """
    Stores a browser push subscription token for a user.
    SQL table: bookings_pushsubscription
    One row per browser/device. A user can have multiple subscriptions
    (different browsers or devices).
    """
    user       = models.ForeignKey(User, on_delete=models.CASCADE,
                                    related_name='push_subscriptions')
    endpoint   = models.TextField(unique=True)
    p256dh     = models.TextField()
    auth       = models.TextField()
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'bookings_pushsubscription'


class InspectionOTP(models.Model):
    """
    Stores OTP for inspection sign-off.
    SQL table: bookings_inspectionotp
    """
    inspection = models.ForeignKey('InspectionRecord', on_delete=models.CASCADE, related_name='otps')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'bookings_inspectionotp'
        ordering = ['-created_at']
    
    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and timezone.now() < self.expires_at