from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0003_adminprofile_vendoradminassignment')]
    operations = [
        migrations.AlterField('user', 'email', models.EmailField(max_length=254)),
        migrations.AlterField('user', 'phone', models.CharField(max_length=15)),
        migrations.AddConstraint('user', models.UniqueConstraint(fields=['email', 'role'], name='uniq_user_email_role')),
        migrations.AddConstraint('user', models.UniqueConstraint(fields=['phone', 'role'], name='uniq_user_phone_role')),
    ]