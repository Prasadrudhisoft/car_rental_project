from celery import shared_task
from django.utils import timezone

from .lifecycle import LifecycleError, mark_no_show
from .models import Booking


@shared_task(queue='default')
def detect_no_shows():
    """Beat: every 30 min. Marks CONFIRMED bookings whose pickup + grace has passed."""
    today = timezone.localdate()
    ids = Booking.objects.filter(status='CONFIRMED', pickup_date__lte=today).values_list('id', flat=True)
    done = 0
    for bid in ids:
        try:
            mark_no_show(bid, auto=True)
            done += 1
        except LifecycleError:
            pass   # grace not elapsed yet
    return done
