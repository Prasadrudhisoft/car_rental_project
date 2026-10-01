from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from car_rent.async_utils import RETRY_POLICY
from .models import HandoverRecord


def _handover(pk):
    return (HandoverRecord.objects
            .select_related('booking__vehicle', 'booking__vendor', 'return_point__city')
            .filter(pk=pk).first())


@shared_task(**RETRY_POLICY)
def send_handover_received_email(handover_id):
    h = _handover(handover_id)
    if not h:
        return
    send_mail(
        subject=f'[CarRent India] Vehicle Received at {h.return_point.name}',
        message=(f'Your vehicle {h.booking.vehicle.plate_number} from booking {h.booking.booking_ref} '
                 f'has been received at {h.return_point.name} in {h.return_point.city.name}.'),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[h.booking.vendor.email], fail_silently=False,
    )


@shared_task(**RETRY_POLICY)
def send_inspection_due_email(handover_id):
    h = _handover(handover_id)
    if not h or not h.full_inspection_due_by:
        return
    send_mail(
        subject='[CarRent India] Vehicle at Parking — Inspection Required',
        message=(f'Your vehicle {h.booking.vehicle.plate_number} has been received at {h.return_point.name}. '
                 f'Please complete a full inspection within 24 hours '
                 f'(by {h.full_inspection_due_by.strftime("%d %b %Y %H:%M")} IST).'),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[h.booking.vendor.email], fail_silently=False,
    )