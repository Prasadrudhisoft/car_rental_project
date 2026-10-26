from rest_framework import serializers
from apps.locations.serializers import LocationSerializer
from .models import Booking, AddOn, InspectionRecord, InspectionPhoto, Invoice
 

def _fmt_location(loc):
    if not loc:
        return ''
    return ', '.join(p for p in [loc.name, loc.address] if p)

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
    pickup_address = serializers.SerializerMethodField()
    return_address = serializers.SerializerMethodField()
 
    class Meta:
        model  = Booking
        fields = ['id', 'booking_ref', 'status', 'status_display',
                'pickup_date', 'pickup_time', 'return_date', 'return_time',
                'rental_days', 'total_amount', 'vehicle_display', 'customer_name',
                'is_one_way', 'pickup_address', 'return_address',
                'payment_captured', 'agreement_signed', 'created_at']
 
    def get_vehicle_display(self, obj):
        if not obj.vehicle:
            return "N/A"
        return f"{obj.vehicle.year} {obj.vehicle.make} {obj.vehicle.model}"

    def get_pickup_address(self, obj):
        return _fmt_location(obj.pickup_location)

    def get_return_address(self, obj):
        return _fmt_location(obj.return_location) if obj.is_one_way else ''

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
 
    # ── Customer identity fields ──────────────────────────────────────────
    customer_name  = serializers.CharField(
        source='customer.full_name', read_only=True, default='')
    customer_email = serializers.CharField(
        source='customer.email', read_only=True, default='')
    customer_phone = serializers.CharField(
        source='customer.phone', read_only=True, default='')
 
    # ── Vendor identity fields (NEW) ──────────────────────────────────────
    vendor_name = serializers.SerializerMethodField()
 
    # ── Vehicle identity fields (NEW) ─────────────────────────────────────
    # vehicle_display already gives "2023 Maruti Swift" — add plate + segment
    # separately so the frontend can show them individually if needed.
    vehicle_plate   = serializers.SerializerMethodField()
    vehicle_segment = serializers.SerializerMethodField()
    agreement_acceptance = serializers.SerializerMethodField()
    payment_summary = serializers.SerializerMethodField()

    def get_payment_summary(self, obj):
        from .payments import PaymentService
        return PaymentService.summary(obj)
 
    class Meta:
        model  = Booking
        fields = '__all__'
 
    def get_vehicle_display(self, obj):
        return f'{obj.vehicle.year} {obj.vehicle.make} {obj.vehicle.model}'
 
    def get_vendor_name(self, obj):
        """Return the vendor's business name for display in admin booking list."""
        try:
            return obj.vendor.vendor_profile.business_name
        except Exception:
            return obj.vendor.full_name or obj.vendor.email or ''
 
    def get_vehicle_plate(self, obj):
        return obj.vehicle.plate_number if obj.vehicle else ''
 
    def get_vehicle_segment(self, obj):
        return obj.vehicle.segment if obj.vehicle else ''

    def get_agreement_acceptance(self, obj):
        accs = sorted(obj.agreement_acceptances.all(), key=lambda a: a.accepted_at, reverse=True)
        if not accs:
            return None
        acc = accs[0]
        return {
            'agreement_version_id': acc.agreement_version_id,
            'version_tag':          acc.agreement_version.version_tag,
            'accepted_at':          acc.accepted_at,
            'otp_verified':         acc.otp_verified,
            'acceptance_method':    acc.acceptance_method,
            'ip_address':           acc.ip_address,
            'booking_ref':          obj.booking_ref,
            'user_email':           obj.customer.email,
        }