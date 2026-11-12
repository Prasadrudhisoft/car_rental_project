from django.apps import AppConfig


class ActivityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.activity'

    def ready(self):
        from . import signals
        signals.connect()          # audit every model + bulk operations, project-wide
