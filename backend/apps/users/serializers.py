from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CustomerProfile, VendorProfile, SavedAddress, AdminProfile, VendorAdminAssignment

User = get_user_model()


# ── Auth serializers ──────────────────────────────────────────────────────

class CustomerRegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ['email', 'phone', 'full_name', 'password', 'password2']

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(role='customer', **validated_data)
        CustomerProfile.objects.create(user=user)
        return user


class VendorRegisterSerializer(serializers.ModelSerializer):
    password      = serializers.CharField(write_only=True, validators=[validate_password])
    password2     = serializers.CharField(write_only=True)
    business_name = serializers.CharField(write_only=True)
    gstin         = serializers.CharField(write_only=True, required=False, default='')

    class Meta:
        model  = User
        fields = ['email', 'phone', 'full_name', 'password', 'password2',
                  'business_name', 'gstin']

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        business_name = validated_data.pop('business_name')
        gstin         = validated_data.pop('gstin', '')
        user          = User.objects.create_user(role='vendor', **validated_data)
        VendorProfile.objects.create(user=user, business_name=business_name, gstin=gstin)
        return user


# ── User (me) serializer ──────────────────────────────────────────────────

class UserMeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['id', 'email', 'phone', 'full_name', 'role',
                  'is_phone_verified', 'is_email_verified']


# ── Customer serializers ──────────────────────────────────────────────────

class SavedAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SavedAddress
        fields = '__all__'
        read_only_fields = ['customer']


class CustomerProfileSerializer(serializers.ModelSerializer):
    email      = serializers.EmailField(source='user.email', read_only=True)
    full_name  = serializers.CharField(source='user.full_name', read_only=True)
    phone      = serializers.CharField(source='user.phone', read_only=True)
    saved_addresses = SavedAddressSerializer(many=True, read_only=True)

    class Meta:
        model  = CustomerProfile
        fields = ['email', 'full_name', 'phone', 'driving_licence', 'dl_expiry',
                  'date_of_birth', 'loyalty_points', 'aadhaar_number', 'pan_number',
                  'kyc_status', 'saved_addresses']
        read_only_fields = ['loyalty_points', 'kyc_status']


# ── Vendor serializers ────────────────────────────────────────────────────

class VendorProfileSerializer(serializers.ModelSerializer):
    """
    Read serializer returned to the vendor for GET /api/users/vendor/profile/
    and to the admin for the vendor list.
    """
    email      = serializers.EmailField(source='user.email', read_only=True)
    full_name  = serializers.CharField(source='user.full_name', read_only=True)
    phone      = serializers.CharField(source='user.phone', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # City details
    city_id    = serializers.PrimaryKeyRelatedField(source='city', read_only=True)
    city_name  = serializers.CharField(source='city.name', read_only=True, default='')
    state      = serializers.CharField(read_only=True)

    class Meta:
        model  = VendorProfile
        fields = [
            'id', 'email', 'full_name', 'phone',
            'business_name', 'gstin',
            'status', 'status_display', 'admin_note',
            'rating', 'total_reviews',
            'is_cooperation_member',
            'shop_opening_time', 'shop_closing_time',
            # Address
            'addr_line1', 'addr_line2', 'addr_line3',
            'city_id', 'city_name', 'state', 'country', 'pincode',
            # Map pin
            'latitude', 'longitude',
            'pickup_location',
            # KYC fields (read-only for list)
            'aadhaar_number', 'pan_number',
            'bank_account_name', 'bank_account_no', 'bank_ifsc',
            'created_at',
        ]


class VendorKYCSerializer(serializers.ModelSerializer):
    """
    PATCH serializer for vendor KYC + address + map-pin submission.
    Endpoint: PATCH /api/users/vendor/kyc/
 
    BUG FIX (validate_kyc_document):
    The original validator called value.content_type unconditionally.
    content_type is only present on InMemoryUploadedFile / TemporaryUploadedFile
    (i.e. a freshly uploaded file from request.FILES).
    On a partial PATCH where kyc_document is not re-sent, DRF passes the
    existing FieldFile object through the validator — which has no
    .content_type attribute — causing an AttributeError that Django REST
    Framework silently converts to a validation failure, rejecting the
    entire PATCH even when the document was not being changed.
    Fix: guard with hasattr() on both content_type and size.
    """
    city = serializers.PrimaryKeyRelatedField(
        queryset=__import__('apps.locations.models', fromlist=['City']).City.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
 
    class Meta:
        model  = VendorProfile
        fields = [
            'aadhaar_number', 'pan_number',
            'bank_account_name', 'bank_account_no', 'bank_ifsc',
            'gstin', 'kyc_document',
            'addr_line1', 'addr_line2', 'addr_line3',
            'city', 'country', 'pincode',
            'shop_opening_time', 'shop_closing_time',
            'latitude', 'longitude',
        ]
 
    def validate_kyc_document(self, value):
        # ← FIX: only inspect upload-specific attrs when they're actually present
        if hasattr(value, 'content_type') and hasattr(value, 'size'):
            allowed = ['application/pdf', 'image/jpeg', 'image/png']
            if value.content_type not in allowed:
                raise serializers.ValidationError(
                    'KYC document must be PDF, JPG, or PNG.'
                )
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError(
                    'File size must be under 5 MB.'
                )
        return value
 
    def save(self, **kwargs):
        instance = super().save(**kwargs)
 
        # Keep state in sync with the chosen city
        if instance.city:
            try:
                if not instance.state or instance.state != instance.city.state:
                    instance.state = instance.city.state
                    instance.save(update_fields=['state'])
            except Exception:
                pass
 
        # Create/update the Location record from the map pin
        if instance.latitude and instance.longitude and instance.city:
            self._sync_pickup_location(instance)
 
        return instance
 
    def _sync_pickup_location(self, instance):
        from apps.locations.models import Location
 
        addr_parts = filter(None, [
            instance.addr_line1,
            instance.addr_line2,
            instance.addr_line3,
            instance.pincode,
        ])
        full_address = ', '.join(addr_parts)
        location_name = f"{instance.business_name}"
 
        if instance.pickup_location_id:
            Location.objects.filter(pk=instance.pickup_location_id).update(
                name          = location_name,
                city          = instance.city,
                address       = full_address,
                latitude      = instance.latitude,
                longitude     = instance.longitude,
                location_type = 'vendor_lot',
                is_active     = True,
            )
        else:
            loc = Location.objects.create(
                name          = location_name,
                city          = instance.city,
                location_type = 'vendor_lot',
                address       = full_address,
                latitude      = instance.latitude,
                longitude     = instance.longitude,
                is_active     = True,
            )
            instance.pickup_location = loc
            instance.save(update_fields=['pickup_location'])



# class VendorProfileFullSerializer(serializers.ModelSerializer):
#     """
#     Complete read serializer for vendor profiles.
#     Used by:
#       - GET /api/users/vendor/profile/   (vendor self-view)
#       - GET /api/users/admin/vendors/    (admin list)
 
#      FIX: VendorProfileSerializer.Meta.fields was missing:
#       • kyc_document       → frontend always showed "Missing"
#       • aadhaar_number     → admin could not verify identity
#       • pan_number         → admin could not verify identity
#       • bank_account_name  → admin could not verify payout details
#       • bank_account_no    → admin could not verify payout details
#       • bank_ifsc          → admin could not verify payout details
#       • addr_line1/2/3     → admin and vendor could not see full address
#       • country, pincode   → incomplete address
#     All of these are now included.
#     """
#     email          = serializers.EmailField(source='user.email',      read_only=True)
#     full_name      = serializers.CharField(source='user.full_name',   read_only=True)
#     phone          = serializers.CharField(source='user.phone',       read_only=True)
#     status_display = serializers.CharField(source='get_status_display', read_only=True)
#     city_id        = serializers.PrimaryKeyRelatedField(source='city', read_only=True)
#     city_name      = serializers.CharField(source='city.name',        read_only=True, default='')
#     state          = serializers.CharField(read_only=True)
 
#     class Meta:
#         model  = VendorProfile
#         fields = [
#             'id',
#             # User fields
#             'email', 'full_name', 'phone',
#             # Business
#             'business_name', 'gstin',
#             # Status
#             'status', 'status_display', 'admin_note',
#             # Ratings
#             'rating', 'total_reviews',
#             'is_cooperation_member',
#             # Hours
#             'shop_opening_time', 'shop_closing_time',
#             # Full address (all lines — were absent from VendorProfileSerializer)
#             'addr_line1', 'addr_line2', 'addr_line3',
#             'city_id', 'city_name', 'state', 'country', 'pincode',
#             # Map pin
#             'latitude', 'longitude',
#             'pickup_location',
#             # KYC identity (were absent from VendorProfileSerializer)
#             'aadhaar_number', 'pan_number',
#             # KYC bank (were absent from VendorProfileSerializer)
#             'bank_account_name', 'bank_account_no', 'bank_ifsc',
#             # KYC document URL — THE PRIMARY BUG: this field was missing
#             'kyc_document',
#             'created_at',
#         ]




class AdminCustomerSerializer(serializers.ModelSerializer):
    """
    Admin-facing serializer for customer accounts.
    Nests the CustomerProfile so the admin user list returns
    driving licence, DOB, loyalty points, KYC status and
    Aadhaar/PAN in one response — no second request needed.
 
    Used exclusively by AdminUserListView when role=customer.
    """
    # ── Profile fields (nested read-only) ─────────────────────────────
    driving_licence  = serializers.CharField(
        source='customer_profile.driving_licence', read_only=True, default='')
    dl_expiry        = serializers.DateField(
        source='customer_profile.dl_expiry', read_only=True, default=None)
    date_of_birth    = serializers.DateField(
        source='customer_profile.date_of_birth', read_only=True, default=None)
    loyalty_points   = serializers.IntegerField(
        source='customer_profile.loyalty_points', read_only=True, default=0)
    aadhaar_number   = serializers.CharField(
        source='customer_profile.aadhaar_number', read_only=True, default='')
    pan_number       = serializers.CharField(
        source='customer_profile.pan_number', read_only=True, default='')
    kyc_status       = serializers.CharField(
        source='customer_profile.kyc_status', read_only=True, default='pending')
 
    # ── Booking count (quick stats) ────────────────────────────────────
    total_bookings   = serializers.SerializerMethodField()
    active_bookings  = serializers.SerializerMethodField()
 
    class Meta:
        model  = get_user_model()
        fields = [
            'id', 'full_name', 'email', 'phone', 'role',
            'is_email_verified', 'is_phone_verified', 'date_joined',
            # profile
            'driving_licence', 'dl_expiry', 'date_of_birth',
            'loyalty_points', 'aadhaar_number', 'pan_number', 'kyc_status',
            # stats
            'total_bookings', 'active_bookings',
        ]
 
    def get_total_bookings(self, obj):
        return obj.bookings_as_customer.count()
 
    def get_active_bookings(self, obj):
        return obj.bookings_as_customer.filter(
            status__in=['CONFIRMED', 'ACTIVE']
        ).count()
    

 
from rest_framework import serializers
# from .models import AdminProfile, VendorAdminAssignment  # add to imports
 
 
# class AdminProfileSerializer(serializers.ModelSerializer):
#     email      = serializers.EmailField(source='user.email', read_only=True)
#     full_name  = serializers.CharField(source='user.full_name', read_only=True)
#     scope_display = serializers.CharField(source='get_scope_display', read_only=True)
 
#     # Computed stats
#     assigned_vendor_count = serializers.SerializerMethodField()
#     assigned_vendor_ids   = serializers.SerializerMethodField()
 
#     class Meta:
#         from apps.users.models import AdminProfile  # local import to avoid circular
#         model  = AdminProfile
#         fields = [
#             'id', 'email', 'full_name',
#             'scope', 'scope_display',
#             'display_name', 'notes',
#             'assigned_vendor_count', 'assigned_vendor_ids',
#             'created_at', 'updated_at',
#         ]
#         read_only_fields = ['created_at', 'updated_at']
 
#     def get_assigned_vendor_count(self, obj):
#         return obj.assigned_vendor_ids.count()
 
#     def get_assigned_vendor_ids(self, obj):
#         return list(obj.assigned_vendor_ids)
 
 
# class VendorAdminAssignmentSerializer(serializers.ModelSerializer):
#     admin_name          = serializers.CharField(source='admin.full_name', read_only=True)
#     admin_email         = serializers.CharField(source='admin.email', read_only=True)
#     vendor_business     = serializers.SerializerMethodField()
#     vendor_email        = serializers.CharField(source='vendor.email', read_only=True)
#     assigned_by_name    = serializers.CharField(source='assigned_by.full_name', read_only=True, default='')
 
#     class Meta:
#         from apps.users.models import VendorAdminAssignment
#         model  = VendorAdminAssignment
#         fields = [
#             'id', 'admin', 'admin_name', 'admin_email',
#             'vendor', 'vendor_business', 'vendor_email',
#             'is_active', 'assigned_at', 'assigned_by',
#             'assigned_by_name', 'notes', 'deactivated_at',
#         ]
#         read_only_fields = ['assigned_at', 'deactivated_at']
 
#     def get_vendor_business(self, obj):
#         try:
#             return obj.vendor.vendor_profile.business_name
#         except Exception:
#             return obj.vendor.full_name
 
 
# class AssignVendorSerializer(serializers.Serializer):
#     """
#     Used by SuperAdmin to assign or reassign a vendor to an admin.
#     POST body: { vendor_id, admin_id, notes? }
#     """
#     vendor_id = serializers.IntegerField()
#     admin_id  = serializers.IntegerField()
#     notes     = serializers.CharField(required=False, allow_blank=True, default='')



# ── Thin user serializer (used inside vendor / admin profiles) ────────────────
class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'phone', 'full_name', 'role',
                  'is_active', 'is_email_verified', 'is_phone_verified']
 
 
# ── VendorProfile — full detail for admin views ───────────────────────────────
class VendorProfileFullSerializer(serializers.ModelSerializer):
    """
    Returned by:
      GET /api/users/admin/vendors/          (AdminVendorListView)
      GET /api/users/vendor/profile/         (VendorProfileDetailView)
      GET /api/users/admin/my-vendors/       (MyAssignedVendorsView)
      GET /api/users/admin/assign-vendor/    (assignment views)
 
    Key field: `user_id` (plain integer) — used by the frontend for Set lookups.
               `user`    (nested object)  — used for display (email, name, phone).
    """
    # Flat integer PK — the frontend uses this for checkbox/Set operations
    user_id     = serializers.IntegerField(source='user.id', read_only=True)
    # Nested object — for display
    email       = serializers.EmailField(source='user.email', read_only=True)
    phone       = serializers.CharField(source='user.phone', read_only=True)
    full_name   = serializers.CharField(source='user.full_name', read_only=True)
    city_name   = serializers.SerializerMethodField()
    city_id     = serializers.IntegerField(source='city.id', read_only=True, default=None)
 
    class Meta:
        model = VendorProfile
        fields = [
            # ── Identity ──────────────────────────────────────────────────
            'id',           # VendorProfile PK
            'user_id',      # User PK (flat int) ← KEY for frontend
            'email',
            'phone',
            'full_name',
            'business_name',
            'gstin',
            # ── KYC ──────────────────────────────────────────────────────
            'aadhaar_number',
            'pan_number',
            'bank_account_name',
            'bank_account_no',
            'bank_ifsc',
            'kyc_document',
            # ── Address ───────────────────────────────────────────────────
            'addr_line1',
            'addr_line2',
            'addr_line3',
            'city',         # FK PK (for dropdowns)
            'city_id',      # explicit flat int
            'city_name',    # human-readable
            'state',
            'country',
            'pincode',
            # ── Location ──────────────────────────────────────────────────
            'latitude',
            'longitude',
            # ── Status ────────────────────────────────────────────────────
            'status',
            'admin_note',
            'rating',
            'total_reviews',
            'is_cooperation_member',
            # ── Shop hours ────────────────────────────────────────────────
            'shop_opening_time',
            'shop_closing_time',
            # ── Timestamps ────────────────────────────────────────────────
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user_id', 'email', 'phone', 'full_name',
                            'city_name', 'city_id', 'created_at', 'updated_at']
 
    def get_city_name(self, obj):
        return obj.city.name if obj.city else None
 
 
# ── AdminProfile serializer ───────────────────────────────────────────────────
class AdminProfileSerializer(serializers.ModelSerializer):
    """
    Returned by:
      GET /api/users/admin/admins/   (AdminListView)
      GET /api/users/admin/me/       (AdminProfileDetailView)
 
    Key field: `user_id` (plain int) — frontend uses this to match
               against assignment.admin values.
    """
    user_id    = serializers.IntegerField(source='user.id',       read_only=True)
    email      = serializers.EmailField  (source='user.email',    read_only=True)
    full_name  = serializers.CharField   (source='user.full_name', read_only=True)
    assigned_vendor_count = serializers.SerializerMethodField()
 
    class Meta:
        model = AdminProfile
        fields = [
            'id',           # AdminProfile PK
            'user_id',      # User PK (flat int) ← KEY for frontend
            'email',
            'full_name',
            'scope',
            'display_name',
            'notes',
            'assigned_vendor_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user_id', 'email', 'full_name',
                            'assigned_vendor_count', 'created_at', 'updated_at']
 
    def get_assigned_vendor_count(self, obj):
        return VendorAdminAssignment.objects.filter(
            admin=obj.user, is_active=True
        ).count()
 
 
# ── VendorAdminAssignment serializer ─────────────────────────────────────────
class VendorAdminAssignmentSerializer(serializers.ModelSerializer):
    """
    Returned by all assignment list / history endpoints.
 
    All FK fields are exposed as BOTH flat ints AND human-readable strings
    so the frontend never needs to do nested lookups.
    """
    # Flat PKs (User PKs, not VendorAdminAssignment PKs)
    vendor          = serializers.IntegerField(source='vendor.id',        read_only=True)
    admin           = serializers.IntegerField(source='admin.id',         read_only=True)
    assigned_by_id  = serializers.IntegerField(source='assigned_by.id',   read_only=True,
                                               default=None, allow_null=True)
 
    # Human-readable strings
    vendor_business = serializers.SerializerMethodField()
    vendor_email    = serializers.EmailField(source='vendor.email',       read_only=True)
    admin_name      = serializers.CharField (source='admin.full_name',    read_only=True)
    admin_email     = serializers.EmailField(source='admin.email',        read_only=True)
    assigned_by_name = serializers.SerializerMethodField()
 
    class Meta:
        model = VendorAdminAssignment
        fields = [
            'id',
            # ── Flat PKs for JS comparisons ────────────────────────────
            'vendor',           # User PK of the vendor
            'admin',            # User PK of the admin
            'assigned_by_id',
            # ── Display strings ────────────────────────────────────────
            'vendor_business',
            'vendor_email',
            'admin_name',
            'admin_email',
            'assigned_by_name',
            # ── Status / timestamps ────────────────────────────────────
            'is_active',
            'assigned_at',
            'deactivated_at',
            'notes',
        ]
 
    def get_vendor_business(self, obj):
        try:
            return obj.vendor.vendor_profile.business_name
        except Exception:
            return obj.vendor.email
 
    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.full_name or obj.assigned_by.email
        return None
 
 
# ── AssignVendorSerializer (input validation) ─────────────────────────────────
class AssignVendorSerializer(serializers.Serializer):
    vendor_id = serializers.IntegerField()
    admin_id  = serializers.IntegerField()
    notes     = serializers.CharField(required=False, allow_blank=True, default='')
 