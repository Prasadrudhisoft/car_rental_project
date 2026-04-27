from rest_framework import serializers
from apps.locations.serializers import LocationSerializer
from .models import Booking, AddOn, InspectionRecord, InspectionPhoto, Invoice
 
 
class AddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AddOn
        fields = ['addon_type', 'price']
 
 
class InspectionPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InspectionPhoto
        fields = ['id', 'image', 'angle', 'uploaded_at']
 
 
class InspectionRecordSerializer(serializers.ModelSerializer):
    photos = InspectionPhotoSerializer(many=True, read_only=True)
 
    class Meta:
        model  = InspectionRecord
        fields = ['id', 'inspection_type', 'odometer_reading', 'fuel_level',
                  'checklist', 'notes', 'damage_reported', 'damage_notes', 'damage_amount',
                  'customer_signed', 'vendor_signed', 'is_locked', 'photos', 'created_at']
 
 
class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Invoice
        fields = '__all__'
 
 
class BookingListSerializer(serializers.ModelSerializer):
    """Minimal fields for list views."""
    booking_ref        = serializers.ReadOnlyField()
    rental_days        = serializers.ReadOnlyField()
    vehicle_display    = serializers.SerializerMethodField()
    customer_name      = serializers.SerializerMethodField()
    status_display     = serializers.CharField(source="get_status_display", read_only=True)
 
    class Meta:
        model  = Booking
        fields = ['id', 'booking_ref', 'status', 'status_display',
                  'pickup_date', 'pickup_time', 'return_date', 'return_time',
                  'rental_days', 'total_amount', 'vehicle_display', 'customer_name', 'created_at']
 
    def get_vehicle_display(self, obj):
        if not obj.vehicle:
            return "N/A"
        return f"{obj.vehicle.year} {obj.vehicle.make} {obj.vehicle.model}"

    def get_customer_name(self, obj):
        return getattr(obj.customer, "full_name", None)
 
 
class BookingDetailSerializer(serializers.ModelSerializer):
    """Full detail including add-ons, inspections, invoice."""
    booking_ref    = serializers.ReadOnlyField()
    rental_days    = serializers.ReadOnlyField()
    addons         = AddOnSerializer(many=True, read_only=True)
    inspections    = InspectionRecordSerializer(many=True, read_only=True)
    invoice        = InvoiceSerializer(read_only=True)
    vehicle_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    pickup_location_detail = LocationSerializer(source='pickup_location', read_only=True)
    return_location_detail = LocationSerializer(source='return_location', read_only=True)
 
    class Meta:
        model  = Booking
        fields = '__all__'
 
    def get_vehicle_display(self, obj):
        return f'{obj.vehicle.year} {obj.vehicle.make} {obj.vehicle.model}'
