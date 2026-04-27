from django.db import models
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class ConfigCategory(models.Model):
    """
    Groups related settings together.
    Example: all pricing rules belong to the 'pricing' category.
    SQL table: config_category
    """
    name       = models.CharField(max_length=100, unique=True)
    slug       = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'config_category'
        ordering = ['name']
        verbose_name_plural = 'Config Categories'
 
    def __str__(self):
        return self.name
 
 
class ConfigSetting(models.Model):
    """
    One row = one configurable business rule.
    Example row:  key='gst_rate', value='18', value_type='percentage'
    SQL table: config_setting
    """
    VALUE_TYPES = [
        ('number',     'Number'),
        ('percentage', 'Percentage  (stored as 18, code reads 0.18)'),
        ('text',       'Text'),
        ('boolean',    'Boolean (true/false)'),
        ('json',       'JSON  (for lists or dicts)'),
    ]
 
    category     = models.ForeignKey(ConfigCategory, on_delete=models.PROTECT,
                                     related_name='settings')
    key          = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    value        = models.TextField()
    value_type   = models.CharField(max_length=20, choices=VALUE_TYPES, default='text')
    description  = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)
    is_editable  = models.BooleanField(default=True)
    updated_at   = models.DateTimeField(auto_now=True)
    created_at   = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'config_setting'
        ordering = ['category', 'key']
 
    def __str__(self):
        return f'{self.key} = {self.value}'
 
 
class ConfigChangeLog(models.Model):
    """
    Records every change ever made to a ConfigSetting.
    Answers: who changed what, when, and from what value to what.
    SQL table: config_change_log
    """
    setting       = models.ForeignKey(ConfigSetting, on_delete=models.CASCADE,
                                      related_name='history')
    changed_by    = models.ForeignKey(User, on_delete=models.SET_NULL,
                                      null=True, related_name='config_changes')
    old_value     = models.TextField()
    new_value     = models.TextField()
    change_reason = models.TextField(blank=True)
    changed_at    = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'config_change_log'
        ordering = ['-changed_at']
 
 
class VehicleSegmentConfig(models.Model):
    """
    Per-vehicle-segment rules: security deposits, minimum driver age.
    One row per segment: hatchback, sedan, suv, luxury, van, truck.
    SQL table: vehicle_segment_config
    """
    SEGMENTS = [
        ('hatchback', 'Hatchback'),
        ('sedan',     'Sedan'),
        ('suv',       'SUV'),
        ('luxury',    'Luxury'),
        ('van',       'Van / MPV'),
        ('truck',     'Truck / Pickup'),
    ]
 
    segment_name              = models.CharField(max_length=50, choices=SEGMENTS, unique=True)
    display_name              = models.CharField(max_length=100)
    security_deposit          = models.DecimalField(max_digits=10, decimal_places=2)
    min_driver_age            = models.PositiveIntegerField(default=21)
    min_rental_days           = models.PositiveIntegerField(default=1)
    platform_commission_override = models.DecimalField(max_digits=5, decimal_places=2,
                                                        null=True, blank=True)
    is_active                 = models.BooleanField(default=True)
    updated_at                = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'vehicle_segment_config'
 
    def __str__(self):
        return f'{self.display_name} — deposit INR {self.security_deposit}'
