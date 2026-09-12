from django.db import migrations


def add_setting(apps, schema_editor):
    ConfigCategory = apps.get_model('configuration', 'ConfigCategory')
    ConfigSetting  = apps.get_model('configuration', 'ConfigSetting')
    logistics_cat = ConfigCategory.objects.get(slug='logistics')
    ConfigSetting.objects.get_or_create(
        key='parking_facilitation_commission_pct',
        defaults={
            'display_name': 'Parking Facilitation Commission',
            'value': '15',
            'value_type': 'percentage',
            'description': (
                'Platform commission taken from the handling fee paid to a '
                'vendor who receives another vendor\'s car for a one-way drop-off. '
                'Stored as 15, applied as 0.15. Separate from the base platform_commission.'
            ),
            'category': logistics_cat,
            'is_active': True,
            'is_editable': True,
            'is_system': True,
        },
    )


def remove_setting(apps, schema_editor):
    ConfigSetting = apps.get_model('configuration', 'ConfigSetting')
    ConfigSetting.objects.filter(key='parking_facilitation_commission_pct').delete()


class Migration(migrations.Migration):
    dependencies = [('configuration', '0005_add_odometer_reverification_setting')]  # ← match your latest
    operations = [migrations.RunPython(add_setting, remove_setting)]