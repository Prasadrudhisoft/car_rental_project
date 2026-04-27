from rest_framework import serializers
from .models import VendorNetwork, ReturnPoint, HandoverRecord, HandoverPhoto, RevenueShare
 
 
class VendorNetworkSerializer(serializers.ModelSerializer):
    city_name        = serializers.CharField(source="city.name", read_only=True)
    business_name    = serializers.CharField(
        source="vendor.vendor_profile.business_name", read_only=True)
    current_held_count = serializers.SerializerMethodField()
 
    class Meta:
        model  = VendorNetwork
        fields = ['id', 'city', 'city_name', 'business_name', 'is_active',
                  'max_vehicles', 'handling_fee_override', 'current_held_count']
 
    def get_current_held_count(self, obj):
        return HandoverRecord.objects.filter(
            receiving_vendor=obj.vendor,
            status__in=['RECEIVED', 'INSPECTED', 'HELD', 'SUBLISTED'],
        ).count()
 
 
class ReturnPointSerializer(serializers.ModelSerializer):
    city_name    = serializers.CharField(source="city.name", read_only=True)
    point_type_display = serializers.CharField(source="get_point_type_display", read_only=True)
    # Handling fee from config or vendor override
    handling_fee = serializers.SerializerMethodField()
 
    class Meta:
        model  = ReturnPoint
        fields = ['id', 'city', 'city_name', 'name', 'point_type', 'point_type_display',
                  'address', 'latitude', 'longitude', 'contact_phone',
                  'handling_fee', 'is_active']
 
    def get_handling_fee(self, obj):
        from apps.configuration.utils import get_config
        if obj.vendor_network_member and obj.vendor_network_member.handling_fee_override:
            return str(obj.vendor_network_member.handling_fee_override)
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
