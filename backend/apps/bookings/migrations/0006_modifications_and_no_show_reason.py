import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('bookings', '0005_booking_modification_count_booking_no_show_at_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField('booking', 'no_show_reason', models.CharField(blank=True, max_length=255)),
        migrations.CreateModel(
            name='BookingModification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('initiator_role', models.CharField(max_length=10)),
                ('status', models.CharField(choices=[('PENDING_PAYMENT', 'Awaiting payment'), ('APPLIED', 'Applied'), ('EXPIRED', 'Expired'), ('FAILED', 'Failed')], default='PENDING_PAYMENT', max_length=20)),
                ('change_types', models.JSONField(default=list)),
                ('reason', models.TextField(blank=True)),
                ('old_values', models.JSONField(default=dict)),
                ('new_values', models.JSONField(default=dict)),
                ('old_total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('new_total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('price_delta', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('modification_fee', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('amount_due', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('refund_due', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('payment_ref', models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='modifications', to='bookings.booking')),
                ('initiated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'bookings_modification', 'ordering': ['-created_at']},
        ),
    ]