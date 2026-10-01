from rest_framework import serializers
from apps.configuration.utils import get_config
from .models import (
    VendorNetwork, ReturnPoint, HandoverRecord, HandoverPhoto, RevenueShare,
    CityParkingRate, VendorCommissionOverride,
)
from .capacity import occupied_count


class CityParkingRateSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model  = CityParkingRate
        fields = ['id', 'city', 'city_name', 'amount', 'is_active', 'updated_at']

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Parking rate cannot be negative.')
        return value


class VendorCommissionOverrideSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.vendor_profile.business_name', read_only=True)
    city_name   = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model  = VendorCommissionOverride
        fields = ['id', 'vendor', 'vendor_name', 'city', 'city_name',
                  'vendor_share_pct', 'reason', 'is_active', 'created_at', 'updated_at']

    def validate_vendor_share_pct(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError('Vendor share must be between 0 and 100.')
        return value


class VendorNetworkSerializer(serializers.ModelSerializer):
    """
    NOTE: handling_fee_override is intentionally NOT in fields — vendors
    can no longer set or see a self-defined fee. The effective rate/split
    is computed read-only via get_effective_rate / get_vendor_earning below,
    sourced entirely from admin-controlled CityParkingRate + VendorCommissionOverride.
    """
    city_name          = serializers.CharField(source="city.name", read_only=True)
    business_name      = serializers.CharField(source="vendor.vendor_profile.business_name", read_only=True)
    current_held_count = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()
    city_parking_rate  = serializers.SerializerMethodField()
    vendor_share_pct   = serializers.SerializerMethodField()
    vendor_earning     = serializers.SerializerMethodField()

    class Meta:
        model  = VendorNetwork
        fields = ['id', 'city', 'city_name', 'business_name', 'is_active',
                  'max_vehicles', 'current_held_count', 'available_slots',
                  'city_parking_rate', 'vendor_share_pct', 'vendor_earning']

    def get_current_held_count(self, obj):
        return occupied_count(obj.vendor_id)

    def get_available_slots(self, obj):
        return max(0, obj.max_vehicles - occupied_count(obj.vendor_id))

    def _rate(self, obj):
        try:
            return obj.city.parking_rate.amount if obj.city.parking_rate.is_active else None
        except CityParkingRate.DoesNotExist:
            return None

    def get_city_parking_rate(self, obj):
        rate = self._rate(obj)
        return str(rate) if rate is not None else None

    def get_vendor_share_pct(self, obj):
        override = VendorCommissionOverride.objects.filter(
            vendor=obj.vendor, city=obj.city, is_active=True).first()
        if override:
            return str(override.vendor_share_pct)
        return str(get_config('parking_default_vendor_share_pct', 70))

    def get_vendor_earning(self, obj):
        rate = self._rate(obj)
        if rate is None:
            return None
        share = self.get_vendor_share_pct(obj)
        from decimal import Decimal
        return str((rate * Decimal(share) / 100).quantize(Decimal('0.01')))


class ReturnPointSerializer(serializers.ModelSerializer):
    city_name    = serializers.CharField(source="city.name", read_only=True)
    point_type_display = serializers.CharField(source="get_point_type_display", read_only=True)
    handling_fee = serializers.SerializerMethodField()

    class Meta:
        model  = ReturnPoint
        fields = ['id', 'city', 'city_name', 'name', 'point_type', 'point_type_display',
                  'address', 'latitude', 'longitude', 'contact_phone',
                  'handling_fee', 'is_active']

    def get_handling_fee(self, obj):
        """Admin-set city rate — same regardless of point_type now."""
        try:
            rate = obj.city.parking_rate
            return str(rate.amount) if rate.is_active else None
        except CityParkingRate.DoesNotExist:
            return str(get_config('cross_city_handling_fee_min', 300))


class HandoverPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HandoverPhoto
        fields = ['id', 'image', 'uploaded_at']


class HandoverRecordSerializer(serializers.ModelSerializer):
    photos          = HandoverPhotoSerializer(many=True, read_only=True)
    return_point_name  = serializers.CharField(source="return_point.name", read_only=True)
    booking_ref     = serializers.CharField(source="booking.booking_ref", read_only=True)
    vehicle_display = serializers.SerializerMethodField()
    originating_vendor_name = serializers.SerializerMethodField()
    receiving_vendor_name   = serializers.SerializerMethodField()
    status_display  = serializers.CharField(source="get_status_display", read_only=True)
    days_held       = serializers.SerializerMethodField()

    class Meta:
        model  = HandoverRecord
        fields = '__all__'

    def get_vehicle_display(self, obj):
        v = obj.booking.vehicle
        return f'{v.year} {v.make} {v.model} — {v.plate_number}'

    def get_originating_vendor_name(self, obj):
        try:
            return obj.booking.vendor.vendor_profile.business_name
        except Exception:
            return '—'

    def get_receiving_vendor_name(self, obj):
        try:
            return obj.receiving_vendor.vendor_profile.business_name if obj.receiving_vendor else None
        except Exception:
            return None

    def get_days_held(self, obj):
        if obj.handover_confirmed_at:
            from django.utils import timezone
            return (timezone.now() - obj.handover_confirmed_at).days
        return 0


class RevenueShareSerializer(serializers.ModelSerializer):
    booking_ref = serializers.CharField(source="booking.booking_ref", read_only=True)

    class Meta:
        model  = RevenueShare
        fields = '__all__'