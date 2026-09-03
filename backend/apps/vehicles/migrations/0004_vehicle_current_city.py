from django.db import migrations, models
import django.db.models.deletion


def backfill_current_city(apps, schema_editor):
    Vehicle = apps.get_model('vehicles', 'Vehicle')
    # Every existing vehicle's current location starts as its home city.
    Vehicle.objects.update(current_city=models.F('city'))


class Migration(migrations.Migration):

    dependencies = [
        ('vehicles', '0003_pending_changes'),   # ← match your actual latest vehicles migration
        ('locations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='current_city',
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.PROTECT,
                related_name='vehicles_currently_here', to='locations.city',
            ),
        ),
        migrations.RunPython(backfill_current_city, migrations.RunPython.noop),
    ]