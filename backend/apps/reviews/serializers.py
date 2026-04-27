from rest_framework import serializers
from .models import Review, VendorRatingSnapshot
 
 
class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Review
        fields = ['id', 'booking', 'vendor_rating', 'vehicle_rating', 'review_text', 'created_at']
 
 
class ReviewListSerializer(serializers.ModelSerializer):
    customer_name  = serializers.CharField(source="customer.full_name", read_only=True)
    vehicle_display = serializers.SerializerMethodField()
 
    class Meta:
        model  = Review
        fields = ['id', 'customer_name', 'vendor_rating', 'vehicle_rating',
                  'review_text', 'vehicle_display', 'created_at']
 
    def get_vehicle_display(self, obj):
        return f'{obj.vehicle.year} {obj.vehicle.make} {obj.vehicle.model}'
 
 
class VendorRatingSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VendorRatingSnapshot
        fields = ['weighted_score', 'total_reviews', 'is_flagged', 'last_updated']
