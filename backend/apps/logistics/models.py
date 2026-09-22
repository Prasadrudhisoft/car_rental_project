from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class VendorNetwork(models.Model):
    """
    Records which vendors have opted into the cooperation network
    for which cities.
    SQL table: logistics_vendornetwork
 
    Example: Rajesh (Mumbai vendor) opts in for Mumbai and Pune.
    Two rows: (vendor=Rajesh, city=Mumbai) and (vendor=Rajesh, city=Pune).
    """
    vendor      = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='network_memberships',
        limit_choices_to={'role': 'vendor'},
    )
    city        = models.ForeignKey(
        'locations.City', on_delete=models.CASCADE, related_name='network_vendors',
    )
    is_active   = models.BooleanField(default=True)
    max_vehicles = models.PositiveIntegerField(
        default=3,
        help_text="Maximum vehicles this vendor can hold at once for other vendors.",
    )
    # handling_fee_override = models.DecimalField(
    #     max_digits=8, decimal_places=2, null=True, blank=True,
    #     help_text="If set, overrides the platform default handling fee for this vendor.",
    # )
    joined_at   = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table      = 'logistics_vendornetwork'
        unique_together = ['vendor', 'city']
        ordering = ['city__name', 'vendor__full_name']
 
    def __str__(self):
        return f'{self.vendor.vendor_profile.business_name} — {self.city.name}'
 
 
class ReturnPoint(models.Model):
    """
    A designated drop-off location in a city.
    SQL table: logistics_returnpoint
 
    Types:
      partner_vendor — another vendor lot (preferred, vehicle can be sub-listed)
      parking        — paid parking provider (vehicle held until retrieval)
    """
    POINT_TYPES = [
        ('partner_vendor', 'Partner Vendor Lot'),
        ('parking',        'Paid Parking Provider'),
    ]
 
    city         = models.ForeignKey(
        'locations.City', on_delete=models.CASCADE, related_name='return_points',
    )
    name         = models.CharField(max_length=200)
    point_type   = models.CharField(max_length=20, choices=POINT_TYPES)
    address      = models.TextField()
    latitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude    = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
 
    # If this point is managed by a vendor in our network
    vendor_network_member = models.ForeignKey(
        VendorNetwork, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='return_points',
    )
    contact_phone = models.CharField(max_length=15, blank=True)
    is_active     = models.BooleanField(default=True)
 
    class Meta:
        db_table = 'logistics_returnpoint'
        ordering = ['city__name', 'name']
 
    def __str__(self):
        return f'{self.name} ({self.city.name}) [{self.point_type}]'
 
 
class HandoverRecord(models.Model):
    """
    Records the handover of a vehicle from a customer to a return point.
    SQL table: logistics_handoverrecord
 
    One row per cross-city return. Tracks:
    - Which booking triggered this handover
    - Which return point received the vehicle
    - Inspection status at the time of handover
    - Vehicle retrieval status (when originating vendor picks it up)
    """
    HANDOVER_STATUS = [
        ('EXPECTED',   'Expected — booking confirmed, not yet returned'),
        ('RECEIVED',   'Received — vehicle dropped off, inspection pending'),
        ('INSPECTED',  'Inspected — full inspection completed'),
        ('HELD',       'Held — awaiting retrieval by originating vendor'),
        ('RETRIEVED',  'Retrieved — originating vendor has collected the vehicle'),
        ('SUBLISTED',  'Sub-listed — receiving vendor has listed for rental'),
    ]
 
    booking      = models.OneToOneField(
        'bookings.Booking', on_delete=models.CASCADE, related_name='handover',
    )
    return_point = models.ForeignKey(
        ReturnPoint, on_delete=models.PROTECT, related_name='handovers',
    )
    receiving_vendor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='received_handovers',
        limit_choices_to={'role': 'vendor'},
    )
    status       = models.CharField(max_length=20, choices=HANDOVER_STATUS, default='EXPECTED')
 
    # Inspection at handover (basic walkround by parking staff)
    handover_photos_uploaded = models.BooleanField(default=False)
    handover_notes           = models.TextField(blank=True)
    handover_confirmed_at    = models.DateTimeField(null=True, blank=True)
 
    # Full inspection (by originating vendor or platform inspector, within 24h)
    full_inspection_due_by   = models.DateTimeField(null=True, blank=True)
    full_inspection_done     = models.BooleanField(default=False)
 
    # Deposit hold extension (customer is informed at booking time)
    deposit_hold_extended    = models.BooleanField(default=False)
 
    # Retrieval
    retrieval_arranged_at    = models.DateTimeField(null=True, blank=True)
    retrieved_at             = models.DateTimeField(null=True, blank=True)
 
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'logistics_handoverrecord'
        ordering = ['-created_at']
 
    def __str__(self):
        return f'Handover for {self.booking.booking_ref} at {self.return_point.name}'
 
 
class HandoverPhoto(models.Model):
    """
    Photos uploaded by parking partner at the time of drop-off.
    SQL table: logistics_handoverphoto
    """
    handover    = models.ForeignKey(HandoverRecord, on_delete=models.CASCADE,
                                     related_name='photos')
    image       = models.ImageField(upload_to="handover_photos/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'logistics_handoverphoto'
 
 
class RevenueShare(models.Model):
    """
    Records how the rental revenue is split on a cross-city return.
    SQL table: logistics_revenueshare
 
    One row per cross-city booking. Stores the actual INR amounts so
    payout reports are straightforward to generate.
    """
    booking           = models.OneToOneField(
        'bookings.Booking', on_delete=models.CASCADE, related_name='revenue_share',
    )
    total_revenue     = models.DecimalField(max_digits=10, decimal_places=2)
    originating_vendor_pct  = models.DecimalField(max_digits=5, decimal_places=2)
    originating_vendor_amt  = models.DecimalField(max_digits=10, decimal_places=2)
    platform_pct      = models.DecimalField(max_digits=5, decimal_places=2)
    platform_amt      = models.DecimalField(max_digits=10, decimal_places=2)
    partner_handling_fee    = models.DecimalField(max_digits=8, decimal_places=2)
    partner_sublisting_pct  = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    partner_sublisting_amt  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    calculated_at     = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'logistics_revenueshare'
 
    def __str__(self):
        return f'Revenue split for {self.booking.booking_ref}'


class CityParkingRate(models.Model):
    """
    Admin-set, fixed parking price for one-way drop-offs in a city.
    ALL vendors offering parking in this city are paid based on this same
    rate — no vendor can set their own price. One row per city.
    SQL table: logistics_cityparkingrate
    """
    city   = models.OneToOneField(
        'locations.City', on_delete=models.CASCADE, related_name='parking_rate',
    )
    amount = models.DecimalField(
        max_digits=8, decimal_places=2,
        help_text="Fixed ₹ parking fee for a one-way drop-off in this city. Set by admin only.",
    )
    is_active  = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='parking_rates_set',
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'logistics_cityparkingrate'

    def __str__(self):
        return f'{self.city.name}: ₹{self.amount}'


class VendorCommissionOverride(models.Model):
    """
    Admin-set, per-vendor split of the CityParkingRate amount for a given
    city. If no row exists for a (vendor, city) pair, the platform-wide
    default split (from Configuration: parking_vendor_share_pct) applies.
    Vendors cannot create, view-edit, or influence these rows — read-only
    to them via the network listing, if at all.
    SQL table: logistics_vendorcommissionoverride
    """
    vendor   = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='parking_commission_overrides',
        limit_choices_to={'role': 'vendor'},
    )
    city     = models.ForeignKey(
        'locations.City', on_delete=models.CASCADE, related_name='vendor_commission_overrides',
    )
    vendor_share_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="% of the CityParkingRate amount this specific vendor keeps. "
                   "The remainder goes to the platform. E.g. 70.00 = vendor keeps 70%.",
    )
    reason     = models.TextField(blank=True, help_text="Internal note — why this vendor gets a different rate.")
    is_active  = models.BooleanField(default=True)
    set_by     = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='commission_overrides_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'logistics_vendorcommissionoverride'
        unique_together = ['vendor', 'city']

    def __str__(self):
        return f'{self.vendor.vendor_profile.business_name} @ {self.city.name}: {self.vendor_share_pct}%'