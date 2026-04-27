from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CustomerProfile, VendorProfile, SavedAddress

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

    City is a FK to admin-managed locations.City — vendor selects from a dropdown.
    State is automatically populated from the selected city (read-only on the model).
    When latitude & longitude are provided, automatically creates/updates
    a locations.Location record (type=vendor_lot) for the vendor's city
    and links it as their pickup_location.
    """
    # Write field: vendor sends city id (integer) chosen from admin-created cities
    city = serializers.PrimaryKeyRelatedField(
        queryset=__import__('apps.locations.models', fromlist=['City']).City.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    # state is derived from city — expose it as read-only so the frontend can
    # display the auto-filled value after save, but vendors cannot write it directly.
    state = serializers.CharField(read_only=True)

    class Meta:
        model  = VendorProfile
        fields = [
            # KYC
            'aadhaar_number', 'pan_number',
            'bank_account_name', 'bank_account_no', 'bank_ifsc',
            'gstin', 'kyc_document',
            # Address
            'addr_line1', 'addr_line2', 'addr_line3',
            'city', 'state', 'country', 'pincode',
            # Shop hours
            'shop_opening_time', 'shop_closing_time',
            # Map pin
            'latitude', 'longitude',
        ]

    def validate_kyc_document(self, value):
        allowed = ['application/pdf', 'image/jpeg', 'image/png']
        if hasattr(value, 'content_type') and value.content_type not in allowed:
            raise serializers.ValidationError('KYC document must be PDF, JPG, or PNG.')
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('File size must be under 5 MB.')
        return value

    def save(self, **kwargs):
        """
        Override save to:
        1. Auto-fill state from city.state (always kept in sync)
        2. Create/update a vendor_lot Location record when lat/lng are provided
        """
        instance = super().save(**kwargs)

        # Auto-fill / sync state from the chosen city
        if instance.city:
            new_state = instance.city.state
            if instance.state != new_state:
                instance.state = new_state
                instance.save(update_fields=['state'])

        # Create/update the Location record from the map pin
        if instance.latitude and instance.longitude and instance.city:
            self._sync_pickup_location(instance)

        return instance

    def _sync_pickup_location(self, instance):
        """
        Create (or update) a locations.Location of type 'vendor_lot'
        linked to this vendor's chosen city + lat/lng.
        We use the business_name as the location name.
        """
        from apps.locations.models import Location

        # Build a human-readable address from the stored fields
        addr_parts = filter(None, [
            instance.addr_line1,
            instance.addr_line2,
            instance.addr_line3,
            instance.pincode,
        ])
        full_address = ', '.join(addr_parts)

        location_name = f"{instance.business_name}"

        if instance.pickup_location_id:
            # Update existing location
            Location.objects.filter(pk=instance.pickup_location_id).update(
                name         = location_name,
                city         = instance.city,
                address      = full_address,
                latitude     = instance.latitude,
                longitude    = instance.longitude,
                location_type= 'vendor_lot',
                is_active    = True,
            )
        else:
            # Create new location
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