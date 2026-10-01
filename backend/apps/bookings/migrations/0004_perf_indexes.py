from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('bookings', '0003_inspectionotp')]
    operations = [
        migrations.AddIndex('booking', models.Index(fields=['status'],             name='bk_status_idx')),
        migrations.AddIndex('booking', models.Index(fields=['vendor', 'status'],   name='bk_vendor_status_idx')),
        migrations.AddIndex('booking', models.Index(fields=['customer', 'status'], name='bk_cust_status_idx')),
        migrations.AddIndex('booking', models.Index(fields=['pickup_date'],        name='bk_pickup_date_idx')),
    ]