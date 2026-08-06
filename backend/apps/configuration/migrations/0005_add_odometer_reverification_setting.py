from django.db import migrations


def add_setting(apps, schema_editor):
    ConfigCategory = apps.get_model('configuration', 'ConfigCategory')
    ConfigSetting  = apps.get_model('configuration', 'ConfigSetting')
    cert_cat = ConfigCategory.objects.get(slug='certification')
    ConfigSetting.objects.get_or_create(
        key='odometer_reverification_km',
        defaults={
            'display_name': 'Odometer Re-verification Distance (km)',
            'value': '10000',
            'value_type': 'number',
            'description': (
                'When a vehicle\'s odometer advances this many km since its last '
                'admin verification, it is automatically flagged for re-verification.'
            ),
            'category': cert_cat,
            'is_active': True,
            'is_editable': True,
            'is_system': True,   # read directly by vehicle-update logic — protected from deletion
        },
    )


def remove_setting(apps, schema_editor):
    ConfigSetting = apps.get_model('configuration', 'ConfigSetting')
    ConfigSetting.objects.filter(key='odometer_reverification_km').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuration', '0004_mark_system_settings'),
    ]

    operations = [
        migrations.RunPython(add_setting, remove_setting),
    ]