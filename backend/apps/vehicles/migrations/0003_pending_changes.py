from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vehicles', '0002_fleet_edit_tracking'),
    ]

    operations = [
        migrations.AddField(model_name='vehicle', name='pending_changes',
                             field=models.JSONField(default=dict, blank=True)),
        migrations.AddField(model_name='vehicle', name='pending_submitted_at',
                             field=models.DateTimeField(null=True, blank=True)),
    ]