from django.db import migrations

SETTINGS = [
    ('modification_cutoff_hours', 'Customer Change Deadline (hours before pickup)', '2',
     'Customers can no longer change a booking this many hours before pickup. 0 = until pickup time.'),
    ('max_modifications', 'Max Customer Changes Per Booking', '2',
     'How many times a customer may change one booking.'),
    ('modification_fee', 'Date Change Fee (INR)', '0',
     'Fee for a customer date change made after the free window. Vehicle and location changes are free.'),
]


def add(apps, schema_editor):
    Cat = apps.get_model('configuration', 'ConfigCategory')
    Setting = apps.get_model('configuration', 'ConfigSetting')
    cat = Cat.objects.get(slug='cancellation')
    for key, name, value, desc in SETTINGS:
        Setting.objects.get_or_create(key=key, defaults={
            'display_name': name, 'value': value, 'value_type': 'number', 'description': desc,
            'category': cat, 'is_active': True, 'is_editable': True, 'is_system': True})


def remove(apps, schema_editor):
    apps.get_model('configuration', 'ConfigSetting').objects.filter(key__in=[s[0] for s in SETTINGS]).delete()


class Migration(migrations.Migration):
    dependencies = [('configuration', '0007_add_parking_default_vendor_share')]
    operations = [migrations.RunPython(add, remove)]