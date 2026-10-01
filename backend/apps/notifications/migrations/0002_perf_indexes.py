from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('notifications', '0001_initial')]
    operations = [
        migrations.AddIndex('notification', models.Index(fields=['recipient', 'created_at'], name='ntf_recipient_created_idx')),
    ]