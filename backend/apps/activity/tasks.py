from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import ActivityLog

RETENTION_DAYS = 30


@shared_task(queue='heavy')
def purge_old_activity_logs():
    """Delete logs older than 30 days, in batches to avoid long table locks."""
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    total = 0
    while True:
        ids = list(ActivityLog.objects.filter(created_at__lt=cutoff)
                   .values_list('id', flat=True)[:5000])
        if not ids:
            break
        total += ActivityLog.objects.filter(id__in=ids)._raw_delete(ActivityLog.objects.db)
    return total
