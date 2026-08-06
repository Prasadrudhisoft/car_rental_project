from rest_framework import serializers
from .models import Vehicle, VehicleDocument, VehiclePhoto, VehicleAvailability
 
 
class VehiclePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VehiclePhoto
        fields = ['id', 'image', 'angle', 'is_cover', 'uploaded_at']
        read_only_fields = ["uploaded_at"]
 
    def validate_image(self, value):
        allowed = ['image/jpeg', 'image/png', 'image/webp']
        if hasattr(value, 'content_type') and value.content_type not in allowed:
            raise serializers.ValidationError('Photos must be JPG, PNG, or WebP.')
        if value.size > 8 * 1024 * 1024:
            raise serializers.ValidationError('Photo must be under 8 MB.')
        return value
 
 
class VehicleDocumentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
 
    class Meta:
        model  = VehicleDocument
        fields = ['id', 'doc_type', 'file', 'status', 'status_display',
                  'admin_note', 'expiry_date', 'uploaded_at']
        read_only_fields = ['status', 'admin_note', 'uploaded_at']
 
    def validate_file(self, value):
        allowed = ['application/pdf', 'image/jpeg', 'image/png']
        if hasattr(value, 'content_type') and value.content_type not in allowed:
            raise serializers.ValidationError('Documents must be PDF, JPG, or PNG.')
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File must be under 10 MB.')
        return value
 
 
class VehicleListSerializer(serializers.ModelSerializer):
    """Used in search results — minimal fields for performance."""
    cover_photo  = serializers.SerializerMethodField()
    city_name    = serializers.CharField(source="city.name", read_only=True)
    vendor_name  = serializers.CharField(source="vendor.vendor_profile.business_name",
                                         read_only=True)
    segment_display = serializers.CharField(source="get_segment_display", read_only=True)
    fuel_display    = serializers.CharField(source="get_fuel_type_display", read_only=True)
    transmission_display = serializers.CharField(
        source="get_transmission_display", read_only=True)
 
    class Meta:
        model  = Vehicle
        fields = ['id', 'make', 'model', 'year', 'segment', 'segment_display',
                  'fuel_type', 'fuel_display', 'transmission', 'transmission_display',
                  'capacity', 'daily_rate', 'city_name', 'status',
                  'is_certified', 'cover_photo', 'vendor_name', 'vehicle_id_code']
 
    def get_cover_photo(self, obj):
        photo = obj.photos.filter(is_cover=True).first() or obj.photos.first()
        if photo and photo.image:
            request = self.context.get("request")
            return request.build_absolute_uri(photo.image.url) if request else photo.image.url
        return None
 
 
class VehicleDetailSerializer(serializers.ModelSerializer):
    """Full vehicle detail — used on vehicle detail page."""
    photos    = VehiclePhotoSerializer(many=True, read_only=True)
    documents = VehicleDocumentSerializer(many=True, read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)
    vendor_name  = serializers.CharField(source="vendor.vendor_profile.business_name",
                                         read_only=True)
    segment_display      = serializers.CharField(source="get_segment_display", read_only=True)
    fuel_display         = serializers.CharField(source="get_fuel_type_display", read_only=True)
    transmission_display = serializers.CharField(
        source="get_transmission_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model  = Vehicle
        fields = '__all__'

    _PENDING_FIELD_LABELS = {
        'make': 'Make', 'model': 'Model', 'year': 'Year', 'colour': 'Colour',
        'segment': 'Segment', 'fuel_type': 'Fuel Type', 'transmission': 'Transmission',
        'capacity': 'Seats', 'daily_rate': 'Daily Rate (₹)', 'city': 'City',
        'pickup_location': 'Pickup Location', 'current_odometer': 'Odometer (km)',
    }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        pending = instance.pending_changes or {}
        readable = []
        for field, new_value in pending.items():
            old_value = getattr(instance, field, None)
            if hasattr(old_value, 'pk'):
                old_value = str(old_value)
            readable.append({
                'field':     field,
                'label':     self._PENDING_FIELD_LABELS.get(field, field),
                'old_value': old_value,
                'new_value': new_value,
            })
        data['pending_changes_readable'] = readable
        return data
 
 
class VehicleCreateSerializer(serializers.ModelSerializer):
    """Used when vendor creates or edits a vehicle listing."""
 
    class Meta:
        model  = Vehicle
        fields = ['make', 'model', 'year', 'colour', 'plate_number',
                  'segment', 'fuel_type', 'transmission', 'capacity',
                  'daily_rate', 'city', 'pickup_location', 'odometer_at_listing']
 
    def validate_year(self, value):
        import datetime
        current_year = datetime.date.today().year
        if value < 2000 or value > current_year + 1:
            raise serializers.ValidationError(f'Year must be between 2000 and {current_year + 1}.')
        return value
 
    def validate_daily_rate(self, value):
        from apps.configuration.utils import get_config
        from decimal import Decimal
        min_rate = get_config("min_daily_rate", Decimal("300"))
        if value < min_rate:
            raise serializers.ValidationError(f'Daily rate must be at least INR {min_rate}.')
        return value
 
 
class VehicleAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model  = VehicleAvailability
        fields = ['id', 'blocked_date', 'reason']
        read_only_fields = ['reason']


class VehicleVendorUpdateSerializer(serializers.ModelSerializer):
    """
    Used when a vendor edits an existing listing (PATCH /vehicles/vendor/{id}/).
    Unlike VehicleCreateSerializer:
      - plate_number is excluded — it's tied to the QR/vehicle_id_code once
        certified and must never silently change under an existing sticker.
      - current_odometer is exposed so vendors keep mileage current, which
        drives the automatic re-verification flag.
    """
    class Meta:
        model  = Vehicle
        fields = ['make', 'model', 'year', 'colour', 'segment', 'fuel_type',
                  'transmission', 'capacity', 'daily_rate', 'city',
                  'pickup_location', 'current_odometer']

    def validate_year(self, value):
        import datetime
        current_year = datetime.date.today().year
        if value < 2000 or value > current_year + 1:
            raise serializers.ValidationError(f'Year must be between 2000 and {current_year + 1}.')
        return value

    def validate_daily_rate(self, value):
        from apps.configuration.utils import get_config
        from decimal import Decimal
        min_rate = get_config("min_daily_rate", Decimal("300"))
        if value < min_rate:
            raise serializers.ValidationError(f'Daily rate must be at least INR {min_rate}.')
        return value

    def validate_current_odometer(self, value):
        if self.instance and value is not None and self.instance.current_odometer:
            if value < self.instance.current_odometer:
                raise serializers.ValidationError('Odometer reading cannot decrease.')
        return value