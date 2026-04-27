from django.contrib import admin
from .models import ConfigCategory, ConfigSetting, ConfigChangeLog, VehicleSegmentConfig
from .utils import invalidate_config_cache
 
 
@admin.register(ConfigCategory)
class ConfigCategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'is_active']
    search_fields = ['name']
 
 
@admin.register(ConfigSetting)
class ConfigSettingAdmin(admin.ModelAdmin):
    list_display   = ['key', 'display_name', 'value', 'value_type', 'category', 'is_active', 'updated_at']
    list_filter    = ['category', 'value_type', 'is_active']
    search_fields  = ['key', 'display_name']
    readonly_fields = ['key', 'value_type', 'created_at', 'updated_at']
 
    def save_model(self, request, obj, form, change):
        if change:
            old = ConfigSetting.objects.get(pk=obj.pk)
            ConfigChangeLog.objects.create(
                setting=obj, changed_by=request.user,
                old_value=old.value, new_value=obj.value,
                change_reason='Changed via Django admin',
            )
        super().save_model(request, obj, form, change)
        invalidate_config_cache(obj.key)
 
 
@admin.register(ConfigChangeLog)
class ConfigChangeLogAdmin(admin.ModelAdmin):
    list_display = ['setting', 'changed_by', 'old_value', 'new_value', 'changed_at']
    readonly_fields = ['setting', 'changed_by', 'old_value', 'new_value', 'changed_at']
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
 
 
@admin.register(VehicleSegmentConfig)
class VehicleSegmentConfigAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'security_deposit', 'min_driver_age', 'is_active']
