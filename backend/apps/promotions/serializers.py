from rest_framework import serializers
from .models import PromoCode
 
class PromoCodeSerializer(serializers.ModelSerializer):
    redemption_count = serializers.SerializerMethodField()
 
    class Meta:
        model  = PromoCode
        fields = ['id','code','description','discount_type','discount_value',
                  'max_discount_cap','min_booking_value','is_single_use',
                  'max_redemptions','valid_from','valid_until','is_active',
                  'redemption_count','created_at']
        read_only_fields = ['created_at','redemption_count']
 
    def get_redemption_count(self, obj):
        return obj.usages.count()
