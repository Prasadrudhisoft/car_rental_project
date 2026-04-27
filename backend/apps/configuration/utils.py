import json
import logging
from decimal import Decimal
from django.core.cache import cache
 
from .models import ConfigSetting, VehicleSegmentConfig
 
logger = logging.getLogger(__name__)
CACHE_TTL = 300   # 5 minutes
 
 
def get_config(key: str, default=None):
    """
    Read one business-rule value by its key.
 
    Usage in other apps:
        from apps.configuration.utils import get_config
        gst      = get_config('gst_rate')          # returns Decimal('0.18')
        free_hrs = get_config('cancellation_free_hours')  # returns int 48
    """
    cache_key = f'cfg:{key}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        s = ConfigSetting.objects.get(key=key, is_active=True)
        val = _cast(s.value, s.value_type)
        cache.set(cache_key, val, CACHE_TTL)
        return val
    except ConfigSetting.DoesNotExist:
        logger.warning(f'Config key not found: {key}. Using default: {default}')
        return default
 
 
def get_segment_config(segment_name: str) -> dict:
    """
    Return all config values for a vehicle segment.
 
    Usage:
        cfg = get_segment_config('suv')
        deposit = cfg['security_deposit']   # Decimal('7000.00')
    """
    cache_key = f'seg:{segment_name}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        s = VehicleSegmentConfig.objects.get(segment_name=segment_name, is_active=True)
        global_comm = get_config('platform_commission', Decimal('0.18'))
        result = {
            'segment_name':     s.segment_name,
            'display_name':     s.display_name,
            'security_deposit': s.security_deposit,
            'min_driver_age':   s.min_driver_age,
            'min_rental_days':  s.min_rental_days,
            'commission_rate':  s.platform_commission_override or global_comm,
        }
        cache.set(cache_key, result, CACHE_TTL)
        return result
    except VehicleSegmentConfig.DoesNotExist:
        logger.error(f'Segment not found: {segment_name}')
        return {}
 
 
def invalidate_config_cache(key: str = None):
    """Called after admin saves a change so the new value is used immediately."""
    if key:
        cache.delete(f'cfg:{key}')
    else:
        keys = [f'cfg:{s.key}' for s in ConfigSetting.objects.all()]
        segs = [f'seg:{s.segment_name}' for s in VehicleSegmentConfig.objects.all()]
        cache.delete_many(keys + segs)
 
 
def _cast(raw: str, vtype: str):
    """Convert text stored in DB to the correct Python type."""
    try:
        if vtype == 'number':
            d = Decimal(raw)
            return int(d) if d == d.to_integral_value() else d
        if vtype == 'percentage':
            return Decimal(raw) / 100
        if vtype == 'boolean':
            return raw.strip().lower() in ('true', '1', 'yes')
        if vtype == 'json':
            return json.loads(raw)
        return raw
    except Exception as e:
        logger.error(f'Cannot cast config value {raw!r} as {vtype}: {e}')
        return raw
