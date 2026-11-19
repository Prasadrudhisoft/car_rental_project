from celery import shared_task
from django.utils import timezone

from .lifecycle import LifecycleError, expire_pending_modification, mark_no_show, sweep_no_shows
from .models import Booking


# @shared_task(queue='default')
# def detect_no_shows():
#     """Beat: every 30 min. A CONFIRMED booking whose pickup DATE has fully passed becomes NO_SHOW."""
#     ids = Booking.objects.filter(status='CONFIRMED',
#                                  pickup_date__lt=timezone.localdate()).values_list('id', flat=True)
#     done = 0
#     for bid in ids:
#         try:
#             mark_no_show(bid, auto=True)
#             done += 1
#         except LifecycleError:
#             pass
#     return done

@shared_task(queue='default')
def detect_no_shows():
    return sweep_no_shows()


@shared_task(queue='default')
def expire_pending_modifications():
    """Beat: every 15 min. Releases date holds of unpaid modification requests."""
    n = 0
    for bid in Booking.objects.filter(pending_modification__isnull=False).values_list('id', flat=True):
        n += bool(expire_pending_modification(bid))
    return n