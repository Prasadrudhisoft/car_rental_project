import re
from rest_framework import serializers
from .models import PromoCode
from .service import active_redemptions


class PromoCodeSerializer(serializers.ModelSerializer):
    redemption_count = serializers.SerializerMethodField()

    class Meta:
        model  = PromoCode
        fields = ['id', 'code', 'description', 'discount_type', 'discount_value',
                  'max_discount_cap', 'min_booking_value', 'is_single_use',
                  'max_redemptions', 'valid_from', 'valid_until', 'is_active',
                  'redemption_count', 'created_at']
        read_only_fields = ['created_at', 'redemption_count']

    def get_redemption_count(self, obj):
        return active_redemptions(obj)

    def validate_code(self, v):
        v = v.strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]{3,30}', v):
            raise serializers.ValidationError('Use 3–30 letters, digits, "-" or "_".')
        qs = PromoCode.objects.filter(code__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This code already exists.')
        return v

    def validate(self, a):
        i = self.instance
        dtype = a.get('discount_type', i.discount_type if i else None)
        value = a.get('discount_value', i.discount_value if i else None)
        vfrom = a.get('valid_from',  i.valid_from  if i else None)
        vuntil = a.get('valid_until', i.valid_until if i else None)
        if value is None or value <= 0:
            raise serializers.ValidationError({'discount_value': 'Discount must be greater than 0.'})
        if dtype == 'percentage' and value > 100:
            raise serializers.ValidationError({'discount_value': 'A percentage cannot exceed 100.'})
        if vfrom and vuntil and vuntil <= vfrom:
            raise serializers.ValidationError({'valid_until': 'Must be after "valid from".'})
        return a