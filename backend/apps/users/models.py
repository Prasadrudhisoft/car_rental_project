from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager — email is the unique login identifier."""

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.setdefault('role', 'admin')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Single user table for all roles.
    SQL table: users_user
    """
    ROLES = [
        ('customer', 'Customer'),
        ('vendor',   'Vendor'),
        ('admin',    'Admin'),
    ]

    email              = models.EmailField(unique=True)
    phone              = models.CharField(max_length=15, unique=True)
    full_name          = models.CharField(max_length=200)
    role               = models.CharField(max_length=20, choices=ROLES, default='customer')
    is_active          = models.BooleanField(default=True)
    is_staff           = models.BooleanField(default=False)
    is_phone_verified  = models.BooleanField(default=False)
    is_email_verified  = models.BooleanField(default=False)
    date_joined        = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['phone', 'full_name', 'role']

    objects = UserManager()

    class Meta:
        db_table = 'users_user'

    def __str__(self):
        return f'{self.full_name} <{self.email}> [{self.role}]'


class CustomerProfile(models.Model):
    """
    Extra fields for customers only.
    SQL table: users_customer_profile
    """
    user              = models.OneToOneField(User, on_delete=models.CASCADE,
                                              related_name='customer_profile')
    driving_licence   = models.CharField(max_length=20, blank=True)
    dl_expiry         = models.DateField(null=True, blank=True)
    date_of_birth     = models.DateField(null=True, blank=True)
    loyalty_points    = models.PositiveIntegerField(default=0)
    aadhaar_number    = models.CharField(max_length=12, blank=True)
    pan_number        = models.CharField(max_length=10, blank=True)
    kyc_status        = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('verified', 'Verified'), ('rejected', 'Rejected')],
        default='pending',
    )

    class Meta:
        db_table = 'users_customer_profile'

    def __str__(self):
        return f'Customer: {self.user.full_name}'


class SavedAddress(models.Model):
    """
    A customer's saved pickup/dropoff addresses.
    SQL table: users_saved_address
    """
    customer   = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE,
                                   related_name='saved_addresses')
    label      = models.CharField(max_length=100)
    address    = models.TextField()
    city       = models.CharField(max_length=100)
    pincode    = models.CharField(max_length=10)
    latitude   = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = 'users_saved_address'


class VendorProfile(models.Model):
    """
    Extra fields for vendor accounts.
    SQL table: users_vendor_profile

    Address flow
    ────────────
    Admin creates City objects (City name + State).
    Vendor fills their business address:
      addr_line1 / addr_line2 / addr_line3   — free text street lines
      city       (FK → locations.City)       — dropdown of admin-created cities
      state      (CharField)                 — auto-populated from city.state; stored
                                               so it survives city renames
      country    (CharField, default India)
      pincode    (CharField)
    Vendor also drops a pin on the map → lat/lng stored here
    and a corresponding Location (type=vendor_lot) is created/updated
    automatically in locations_location via the serializer save() logic.
    """
    STATUS = [
        ('pending',   'Pending Review'),
        ('approved',  'Approved'),
        ('rejected',  'Rejected'),
        ('more_info', 'More Info Required'),
        ('suspended', 'Suspended'),
    ]

    user              = models.OneToOneField(User, on_delete=models.CASCADE,
                                              related_name='vendor_profile')
    business_name     = models.CharField(max_length=200)
    gstin             = models.CharField(max_length=15, blank=True)

    # ── KYC ──────────────────────────────────────────────────────
    aadhaar_number    = models.CharField(max_length=12, blank=True)
    pan_number        = models.CharField(max_length=10, blank=True)
    bank_account_name = models.CharField(max_length=200, blank=True)
    bank_account_no   = models.CharField(max_length=20, blank=True)
    bank_ifsc         = models.CharField(max_length=11, blank=True)
    kyc_document      = models.FileField(upload_to='vendor_kyc/', blank=True, null=True)

    # ── Business Address ─────────────────────────────────────────
    # Street lines (free text)
    addr_line1        = models.CharField(max_length=255, blank=True,
                                         verbose_name='Address Line 1')
    addr_line2        = models.CharField(max_length=255, blank=True,
                                         verbose_name='Address Line 2')
    addr_line3        = models.CharField(max_length=255, blank=True,
                                         verbose_name='Address Line 3 (Landmark / Area)')
    # City — FK to the admin-managed City table
    city              = models.ForeignKey(
        'locations.City',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='vendor_profiles',
        verbose_name='City',
    )
    # State — stored as text (auto-filled from city.state)
    state             = models.CharField(max_length=100, blank=True,
                                          verbose_name='State')
    country           = models.CharField(max_length=100, blank=True, default='India',
                                          verbose_name='Country')
    pincode           = models.CharField(max_length=10, blank=True,
                                          verbose_name='PIN Code')

    # ── Map pin — vendor's exact pickup location ─────────────────
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # The Location record created from the map pin
    pickup_location   = models.ForeignKey(
        'locations.Location',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='vendor_profiles',
        verbose_name='Pickup Location (auto-created from map pin)',
    )

    # ── Status / ratings ─────────────────────────────────────────
    status            = models.CharField(max_length=20, choices=STATUS, default='pending')
    admin_note        = models.TextField(blank=True)
    rating            = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews     = models.PositiveIntegerField(default=0)
    is_cooperation_member = models.BooleanField(default=False)

    # ── Shop hours ────────────────────────────────────────────────
    shop_opening_time = models.TimeField(null=True, blank=True)
    shop_closing_time = models.TimeField(null=True, blank=True)

    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users_vendor_profile'

    def __str__(self):
        return f'Vendor: {self.business_name} [{self.status}]'

    # ── Auto-fill state from city ─────────────────────────────────
    def save(self, *args, **kwargs):
        # Keep state in sync with the chosen city
        if self.city_id and not self.state:
            try:
                self.state = self.city.state
            except Exception:
                pass
        super().save(*args, **kwargs)




from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class AdminProfile(models.Model):
    """
    Extra fields for admin accounts.
    SQL table: users_admin_profile
 
    scope:
      'superadmin'      — sees everything, can assign vendors to other admins
      'assigned_admin'  — sees only their assigned vendors + those vendors' customers/bookings
    """
    SCOPE_CHOICES = [
        ('superadmin',      'Super Admin — full platform access'),
        ('assigned_admin',  'Assigned Admin — scoped to assigned vendors only'),
    ]
 
    user              = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='admin_profile',
        limit_choices_to={'role': 'admin'},
    )
    scope             = models.CharField(
        max_length=20, choices=SCOPE_CHOICES, default='assigned_admin',
    )
    display_name      = models.CharField(max_length=200, blank=True)
    notes             = models.TextField(blank=True)
 
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'users_admin_profile'
 
    def __str__(self):
        return f'Admin: {self.user.full_name} [{self.scope}]'
 
    @property
    def is_superadmin(self):
        return self.scope == 'superadmin'
 
    @property
    def assigned_vendor_ids(self):
        """Returns a queryset of vendor User PKs assigned to this admin."""
        return VendorAdminAssignment.objects.filter(
            admin=self.user, is_active=True
        ).values_list('vendor_id', flat=True)
 
 
class VendorAdminAssignment(models.Model):
    """
    Links a vendor to the admin responsible for managing them.
    SQL table: users_vendor_admin_assignment
 
    Rules:
    - A vendor can have at most ONE active admin assignment at a time.
    - Superadmins can reassign vendors between admins.
    - Historical assignments are kept (is_active=False) for audit.
    """
    admin   = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='vendor_assignments',
        limit_choices_to={'role': 'admin'},
    )
    vendor  = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='admin_assignments',
        limit_choices_to={'role': 'vendor'},
    )
    is_active       = models.BooleanField(default=True)
    assigned_at     = models.DateTimeField(auto_now_add=True)
    assigned_by     = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assignments_made',
        limit_choices_to={'role': 'admin'},
    )
    notes           = models.TextField(blank=True)
    deactivated_at  = models.DateTimeField(null=True, blank=True)
 
    class Meta:
        db_table = 'users_vendor_admin_assignment'
        ordering = ['-assigned_at']
        # Only one active assignment per vendor
        constraints = [
            models.UniqueConstraint(
                fields=['vendor'],
                condition=models.Q(is_active=True),
                name='unique_active_vendor_assignment',
            )
        ]
 
    def __str__(self):
        status = 'active' if self.is_active else 'inactive'
        return f'{self.vendor.vendor_profile.business_name} → {self.admin.full_name} [{status}]'
 
    def deactivate(self, deactivated_by=None):
        """Soft-deactivate this assignment."""
        from django.utils import timezone
        self.is_active = False
        self.deactivated_at = timezone.now()
        if deactivated_by:
            self.notes += f' | Deactivated by {deactivated_by.email}'
        self.save(update_fields=['is_active', 'deactivated_at', 'notes'])
 