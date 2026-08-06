from django.db import migrations

SYSTEM_KEYS = [
    'gst_rate', 'min_daily_rate', 'platform_commission',
    'cancellation_free_hours', 'cancellation_half_refund_hours',
    'loyalty_points_per_inr', 'loyalty_points_inr_value',
    'cross_city_handling_fee_min', 'cross_city_partner_sublisting_pct',
    'certification_validity_months', 'certification_validity_km',
    'vendor_suspend_rating',
]


def mark_system(apps, schema_editor):
    ConfigSetting = apps.get_model('configuration', 'ConfigSetting')
    ConfigSetting.objects.filter(key__in=SYSTEM_KEYS).update(is_system=True)


def unmark_system(apps, schema_editor):
    ConfigSetting = apps.get_model('configuration', 'ConfigSetting')
    ConfigSetting.objects.filter(key__in=SYSTEM_KEYS).update(is_system=False)


class Migration(migrations.Migration):

    dependencies = [
        ('configuration', '0003_add_is_system_field'),
    ]

    operations = [
        migrations.RunPython(mark_system, unmark_system),
    ]