from django.db import migrations


def add_setting(apps, schema_editor):
    ConfigCategory = apps.get_model('configuration', 'ConfigCategory')
    ConfigSetting  = apps.get_model('configuration', 'ConfigSetting')
    logistics_cat = ConfigCategory.objects.get(slug='logistics')
    ConfigSetting.objects.get_or_create(
        key='parking_default_vendor_share_pct',
        defaults={
            'display_name': 'Default Parking Vendor Share',
            'value': '70',
            'value_type': 'percentage',
            'description': (
                'Default % of the city parking rate a receiving vendor keeps, '
                'used when no per-vendor commission override is set. '
                'E.g. 70 means vendor keeps 70%, platform keeps the remaining 30%.'
            ),
            'category': logistics_cat,
            'is_active': True,
            'is_editable': True,
            'is_system': True,
        },
    )


def remove_setting(apps, schema_editor):
    ConfigSetting = apps.get_model('configuration', 'ConfigSetting')
    ConfigSetting.objects.filter(key='parking_default_vendor_share_pct').delete()


class Migration(migrations.Migration):
    dependencies = [('configuration', '0006_add_parking_facilitation_commission')]
    operations = [migrations.RunPython(add_setting, remove_setting)]