import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'car_rent.settings.dev')

app = Celery('car_rent')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()