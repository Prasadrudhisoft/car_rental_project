from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('vehicles', '0004_vehicle_current_city')]
    operations = [
        migrations.AddIndex('vehicle', models.Index(fields=['status', 'current_city', 'is_blacklisted'], name='veh_search_idx')),
        migrations.AddIndex('vehicleavailability', models.Index(fields=['blocked_date'], name='avail_date_idx')),
    ]