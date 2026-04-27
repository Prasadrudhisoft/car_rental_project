from rest_framework import serializers
from .models import ConfigSetting, VehicleSegmentConfig, ConfigChangeLog
 
 
class ConfigSettingSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
 
    class Meta:
        model  = ConfigSetting
        fields = ['id','key','display_name','value','value_type',
                  'description','is_active','is_editable','category_name','updated_at']
        read_only_fields = ['key','value_type','is_editable','updated_at']
 
    def validate(self, attrs):
        if self.instance and not self.instance.is_editable:
            raise serializers.ValidationError('This setting is protected.')
        return attrs
 
 
class VehicleSegmentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VehicleSegmentConfig
        fields = '__all__'
 
    def validate_security_deposit(self, value):
        if value < 0:
            raise serializers.ValidationError('Deposit cannot be negative.')
        return value
 
 
class ConfigChangeLogSerializer(serializers.ModelSerializer):
    changed_by = serializers.StringRelatedField()
 
    class Meta:
        model  = ConfigChangeLog
        fields = ['changed_by','old_value','new_value','change_reason','changed_at']
