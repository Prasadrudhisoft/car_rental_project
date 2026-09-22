from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('logistics', '0002_initial')
    ]

    operations = [
        migrations.CreateModel(
            name='CityParkingRate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=8)),
                ('is_active', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('city', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='parking_rate', to='locations.city')),
                ('updated_by', models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='parking_rates_set', to='users.user')),
            ],
            options={'db_table': 'logistics_cityparkingrate'},
        ),
        migrations.CreateModel(
            name='VendorCommissionOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('vendor_share_pct', models.DecimalField(decimal_places=2, max_digits=5)),
                ('reason', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('vendor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='parking_commission_overrides', to='users.user')),
                ('city', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vendor_commission_overrides', to='locations.city')),
                ('set_by', models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commission_overrides_created', to='users.user')),
            ],
            options={
                'db_table': 'logistics_vendorcommissionoverride',
                'unique_together': {('vendor', 'city')},
            },
        ),
    ]