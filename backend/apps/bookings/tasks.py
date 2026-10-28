import logging
from decimal import Decimal
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from car_rent.async_utils import RETRY_POLICY
from .models import Booking

logger = logging.getLogger(__name__)


def _get(booking_id, *related):
    try:
        return Booking.objects.select_related(*related).get(pk=booking_id)
    except Booking.DoesNotExist:
        return None


@shared_task(**RETRY_POLICY)
def send_booking_confirmation(booking_id):
    booking = _get(booking_id, 'customer', 'vehicle', 'pickup_location')
    if not booking:
        return
    send_mail(
        subject=f'[CarRent India] Booking Confirmed — {booking.booking_ref}',
        message=(
            f'Dear {booking.customer.full_name},\n\n'
            f'Your booking {booking.booking_ref} is confirmed.\n'
            f'Vehicle: {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}\n'
            f'Pickup: {booking.pickup_date} at {booking.pickup_location}\n'
            f'Return: {booking.return_date}\n\n'
            f'Please carry your driving licence at pickup.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.customer.email],
        fail_silently=False,
    )


@shared_task(**RETRY_POLICY)
def send_pickup_reminder(booking_id):
    booking = _get(booking_id, 'customer')
    if not booking or booking.status != 'CONFIRMED':
        return
    send_mail(
        subject=f'[CarRent India] Pickup Reminder — {booking.booking_ref}',
        message=f'Reminder: your vehicle pickup is tomorrow on {booking.pickup_date}. Remember to carry your driving licence.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.customer.email],
        fail_silently=False,
    )


@shared_task(**RETRY_POLICY)
def send_invoice_email(booking_id):
    booking = _get(booking_id, 'customer')
    if not booking:
        return
    send_mail(
        subject=f'[CarRent India] Invoice — {booking.booking_ref}',
        message=f'Your rental is complete. Your invoice for {booking.booking_ref} is attached to your account. Thank you for using CarRent India.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.customer.email],
        fail_silently=False,
    )


@shared_task(**RETRY_POLICY)
def generate_agreement_pdf_task(booking_id):
    from .pdf_generator import generate_agreement_pdf
    booking = _get(booking_id, 'customer', 'vehicle')
    if booking:
        generate_agreement_pdf(booking)


@shared_task(**RETRY_POLICY)
def generate_invoice_task(booking_id):
    from .pdf_generator import generate_invoice_pdf
    booking = _get(booking_id)
    if booking:
        generate_invoice_pdf(booking)


# @shared_task(**RETRY_POLICY)
# def issue_razorpay_refund(booking_id, amount):
#     import razorpay
#     booking = _get(booking_id)
#     if not booking:
#         return
#     left = Decimal(str(amount))
#     pays = [p for p in (booking.pricing_snapshot or {}).get('payments', [])
#             if p.get('method') == 'razorpay' and p.get('ref')]
#     if not pays and booking.razorpay_payment_id:           # payment taken but not recorded (conflict case)
#         pays = [{'ref': booking.razorpay_payment_id, 'amount': str(left)}]
#     client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
#     for p in reversed(pays):
#         if left <= 0:
#             break
#         part = min(left, Decimal(p['amount']))
#         client.payment.refund(p['ref'], {'amount': int(part * 100),
#                                          'notes': {'reason': (booking.cancellation_reason or '')[:200]}})
#         left -= part