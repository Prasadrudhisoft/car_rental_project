from django.db import migrations, models


def backfill_odometer(apps, schema_editor):
    Vehicle = apps.get_model('vehicles', 'Vehicle')
    for v in Vehicle.objects.all():
        v.current_odometer = v.odometer_at_listing
        v.last_verified_odometer = v.odometer_at_listing
        v.save(update_fields=['current_odometer', 'last_verified_odometer'])


class Migration(migrations.Migration):

    dependencies = [
        ('vehicles', '0001_initial'),
    ]

    operations = [
        migrations.AddField(model_name='vehicle', name='current_odometer',
                             field=models.PositiveIntegerField(null=True, blank=True)),
        migrations.AddField(model_name='vehicle', name='last_verified_odometer',
                             field=models.PositiveIntegerField(null=True, blank=True)),
        migrations.AddField(model_name='vehicle', name='needs_reverification',
                             field=models.BooleanField(default=False)),
        migrations.AddField(model_name='vehicle', name='needs_review',
                             field=models.BooleanField(default=False)),
        migrations.AddField(model_name='vehicle', name='last_edited_at',
                             field=models.DateTimeField(null=True, blank=True)),
        migrations.AddField(model_name='vehicle', name='last_edit_summary',
                             field=models.TextField(blank=True)),
        migrations.AddField(model_name='vehicle', name='admin_reviewed_edit_at',
                             field=models.DateTimeField(null=True, blank=True)),
        migrations.RunPython(backfill_odometer, migrations.RunPython.noop),
    ]