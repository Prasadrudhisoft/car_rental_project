from django.utils.text import slugify
from rest_framework import serializers
from .models import ConfigSetting, VehicleSegmentConfig, ConfigChangeLog, ConfigCategory


class ConfigCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = ConfigCategory
        fields = ['id', 'name', 'slug', 'description', 'is_active']


class ConfigSettingSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model  = ConfigSetting
        fields = ['id', 'key', 'display_name', 'value', 'value_type', 'description',
                  'is_active', 'is_editable', 'is_system', 'category', 'category_name',
                  'updated_at']
        read_only_fields = ['key', 'updated_at', 'is_system']

    def validate(self, attrs):
        if self.instance and not self.instance.is_editable:
            raise serializers.ValidationError('This setting is protected.')

        if self.instance is None:
            # ── Creating a new setting: derive the key from the display name.
            # Admins never see or type a "key" — it's generated here so it
            # can never collide by accident or by typo.
            display_name = (attrs.get('display_name') or '').strip()
            if not display_name:
                raise serializers.ValidationError({'display_name': 'Please give this setting a name.'})

            base_key = slugify(display_name).replace('-', '_')
            if not base_key:
                raise serializers.ValidationError({
                    'display_name': 'Please use letters or numbers in the name.'
                })

            existing = ConfigSetting.objects.filter(key=base_key).first()
            if existing:
                if existing.is_active:
                    raise serializers.ValidationError({
                        'display_name': (
                            f'A setting called "{existing.display_name}" already exists with a very '
                            f'similar name. Please edit that setting instead of creating a new one — '
                            f'search for "{existing.display_name}" above.'
                        )
                    })
                else:
                    raise serializers.ValidationError({
                        'display_name': (
                            f'A setting called "{existing.display_name}" with a very similar name was '
                            f'archived earlier. Restore it from Archived Settings instead of creating '
                            f'a new one.'
                        )
                    })

            attrs['key'] = base_key
            attrs['is_system'] = False  # settings created via the UI are never system settings

        return attrs

    def update(self, instance, validated_data):
        # key / value_type / is_system are immutable after creation.
        validated_data.pop('key', None)
        validated_data.pop('value_type', None)
        validated_data.pop('is_system', None)
        return super().update(instance, validated_data)


class VehicleSegmentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VehicleSegmentConfig
        fields = '__all__'

    def validate_security_deposit(self, value):
        if value < 0:
            raise serializers.ValidationError('Deposit cannot be negative.')
        return value

    def validate_platform_commission_override(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError('Commission override must be between 0 and 100.')
        return value


class ConfigChangeLogSerializer(serializers.ModelSerializer):
    changed_by = serializers.StringRelatedField()

    class Meta:
        model  = ConfigChangeLog
        fields = ['id', 'changed_by', 'old_value', 'new_value', 'change_reason', 'changed_at']