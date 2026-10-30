from django.db import migrations


def fix(apps, schema_editor):
    User = apps.get_model('users', 'User')
    AdminProfile = apps.get_model('users', 'AdminProfile')
    User.objects.filter(is_superuser=True).exclude(role='admin').update(role='admin')
    for u in User.objects.filter(is_superuser=True):
        AdminProfile.objects.update_or_create(user=u, defaults={'scope': 'superadmin'})


class Migration(migrations.Migration):
    dependencies = [('users', '0006_user_uniq_user_email_role')]
    operations = [migrations.RunPython(fix, migrations.RunPython.noop)]