from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class Vehicle(models.Model):
    """
    One row = one car listed on the platform.
    SQL table: vehicles_vehicle
    """
 
    STATUS_CHOICES = [
        ('PENDING_DOCS',    'Pending Documents'),
        ('DOCS_SUBMITTED',  'Documents Submitted'),
        ('ADMIN_APPROVED',  'Admin Approved'),
        ('CERTIFIED',       'Mechanic Certified'),
        ('LIVE',            'Live — Visible to Customers'),
        ('INACTIVE',        'Inactive'),
    ]
 
    FUEL_TYPES = [
        ('petrol',   'Petrol'),
        ('diesel',   'Diesel'),
        ('electric', 'Electric'),
        ('hybrid',   'Hybrid'),
        ('cng',      'CNG'),
    ]
 
    TRANSMISSION = [
        ('manual',    'Manual'),
        ('automatic', 'Automatic'),
    ]
 
    SEGMENTS = [
        ('hatchback', 'Hatchback'),
        ('sedan',     'Sedan'),
        ('suv',       'SUV'),
        ('luxury',    'Luxury'),
        ('van',       'Van / MPV'),
        ('truck',     'Truck / Pickup'),
    ]
 
    # Ownership
    vendor = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='vehicles',
        limit_choices_to={'role': 'vendor'},
    )
 
    # Core identity
    make         = models.CharField(max_length=100)
    model        = models.CharField(max_length=100)
    year         = models.PositiveIntegerField()
    colour       = models.CharField(max_length=50, blank=True)
    plate_number = models.CharField(max_length=20, unique=True)
 
    # Specifications
    segment      = models.CharField(max_length=20, choices=SEGMENTS)
    fuel_type    = models.CharField(max_length=20, choices=FUEL_TYPES)
    transmission = models.CharField(max_length=20, choices=TRANSMISSION)
    capacity     = models.PositiveIntegerField(help_text="Number of seats")
 
    # Pricing & availability
    daily_rate       = models.DecimalField(max_digits=8, decimal_places=2)
    city             = models.ForeignKey(
        'locations.City', on_delete=models.PROTECT, related_name='vehicles'
    )
    pickup_location  = models.ForeignKey(
        'locations.Location', on_delete=models.SET_NULL, null=True, blank=True
    )

    # ── NEW: where the vehicle physically is right now, vs. its home city ──
    current_city = models.ForeignKey(
        'locations.City', on_delete=models.PROTECT,
        related_name='vehicles_currently_here',
        null=True, blank=True,
        help_text=(
            "Vehicle's real-time location. Defaults to `city` at listing time. "
            "Updated after a one-way trip completes a handover — this is what "
            "customer search filters on, NOT `city`."
        ),
    )
    pickup_location  = models.ForeignKey(
        'locations.Location', on_delete=models.SET_NULL, null=True, blank=True
    )
 
    # Odometer
    odometer_at_listing = models.PositiveIntegerField(default=0)
 
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_DOCS')
 
    # QR / verification
    vehicle_id_code  = models.CharField(max_length=20, blank=True, unique=True, null=True)
    qr_code_image    = models.ImageField(upload_to="vehicle_qr/", blank=True, null=True)
    qr_intact        = models.BooleanField(default=True)
 
    # Certification
    cert_expiry_date  = models.DateField(null=True, blank=True)
    cert_expiry_km    = models.PositiveIntegerField(null=True, blank=True)
    is_certified      = models.BooleanField(default=False)
 
    # Flags
    is_blacklisted    = models.BooleanField(default=False)
    blacklist_reason  = models.TextField(blank=True)
    admin_note        = models.TextField(blank=True)
 
    # Timestamps
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    # ── Odometer tracking / re-verification ───────────────────────────
    current_odometer       = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Latest odometer reading reported by the vendor."
    )
    last_verified_odometer = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Odometer reading recorded at the last admin verification."
    )
    needs_reverification   = models.BooleanField(default=False)

    # ── Vendor-edit tracking (admin visibility) ────────────────────────
    needs_review           = models.BooleanField(
        default=False,
        help_text="True when the vendor edited details after the vehicle was already reviewed/live."
    )
    last_edited_at         = models.DateTimeField(null=True, blank=True)
    last_edit_summary      = models.TextField(blank=True)
    admin_reviewed_edit_at = models.DateTimeField(null=True, blank=True)
    pending_changes         = models.JSONField(default=dict, blank=True)
    pending_submitted_at    = models.DateTimeField(null=True, blank=True)
 
    class Meta:
        db_table = 'vehicles_vehicle'
        ordering = ['-created_at']
 
    def __str__(self):
        return f'{self.year} {self.make} {self.model} [{self.plate_number}]'


class VehicleDocument(models.Model):
    """
    One row per uploaded document for a vehicle.
    SQL table: vehicles_vehicledocument
    Each document type (RC, insurance, PUC) is one row.
    Admin approves or rejects each document individually.
    """
 
    DOC_TYPES = [
        ('rc',          'Registration Certificate (RC Book)'),
        ('insurance',   'Insurance Certificate'),
        ('puc',         'Pollution Under Control (PUC)'),
        ('fitness',     'Fitness Certificate'),
        ('mechanic_cert','Mechanic Certification Report'),
    ]
 
    REVIEW_STATUS = [
        ('pending',  'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
 
    vehicle     = models.ForeignKey(Vehicle, on_delete=models.CASCADE,
                                    related_name='documents')
    doc_type    = models.CharField(max_length=20, choices=DOC_TYPES)
    file        = models.FileField(upload_to="vehicle_docs/")
    status      = models.CharField(max_length=10, choices=REVIEW_STATUS, default='pending')
    admin_note  = models.TextField(blank=True)
 
    # Expiry dates (optional — relevant for insurance, PUC)
    expiry_date = models.DateField(null=True, blank=True)
 
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                    blank=True, related_name='reviewed_docs')
 
    class Meta:
        db_table = 'vehicles_vehicledocument'
        unique_together = ['vehicle', 'doc_type']
        # One row per doc type per vehicle. If vendor re-uploads, update the row.
 
    def __str__(self):
        return f'{self.vehicle} — {self.doc_type} [{self.status}]'
 
 
class VehiclePhoto(models.Model):
    """
    One row per photo of a vehicle.
    SQL table: vehicles_vehiclephoto
    Minimum 10 photos required before status can advance to DOCS_SUBMITTED.
    """
 
    PHOTO_ANGLES = [
        ('front',     'Front'),
        ('rear',      'Rear'),
        ('left',      'Left Side'),
        ('right',     'Right Side'),
        ('interior',  'Interior / Cabin'),
        ('dashboard', 'Dashboard'),
        ('boot',      'Boot / Trunk'),
        ('other',     'Other'),
    ]
 
    vehicle   = models.ForeignKey(Vehicle, on_delete=models.CASCADE,
                                  related_name='photos')
    image     = models.ImageField(upload_to="vehicle_photos/")
    angle     = models.CharField(max_length=20, choices=PHOTO_ANGLES, default="other")
    is_cover  = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'vehicles_vehiclephoto'
        ordering = ['-is_cover', 'angle']
 
    def __str__(self):
        return f'{self.vehicle} — {self.angle}'
 
 
class VehicleAvailability(models.Model):
    """
    Tracks blocked dates for a vehicle.
    SQL table: vehicles_vehicleavailability
    One row per blocked date. Dates NOT in this table are available.
    Vendor can manually block dates (maintenance, personal use).
    Booking system auto-adds rows when a booking is confirmed.
    """
    BLOCK_REASONS = [
        ('manual',  'Manually blocked by vendor'),
        ('booking', 'Blocked by confirmed booking'),
    ]
 
    vehicle    = models.ForeignKey(Vehicle, on_delete=models.CASCADE,
                                   related_name='availability')
    blocked_date = models.DateField()
    reason       = models.CharField(max_length=20, choices=BLOCK_REASONS, default='manual')
    booking_ref  = models.CharField(max_length=50, blank=True)
 
    class Meta:
        db_table = 'vehicles_vehicleavailability'
        unique_together = ['vehicle', 'blocked_date']
