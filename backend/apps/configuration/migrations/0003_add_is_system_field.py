from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuration', '0002_seed_config_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='configsetting',
            name='is_system',
            field=models.BooleanField(default=False),
        ),
    ]