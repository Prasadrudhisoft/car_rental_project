from celery import shared_task
from django.core.mail import send_mail
 
 
@shared_task
def send_booking_confirmation(booking_id: int):
    """Sent immediately after payment is verified."""
    from .models import Booking
    try:
        booking = Booking.objects.select_related("customer", "vehicle").get(pk=booking_id)
        send_mail(
            subject    = f'[CarRent India] Booking Confirmed — {booking.booking_ref}',
            message    = (
                f'Dear {booking.customer.full_name},\n\n'
                f'Your booking {booking.booking_ref} is confirmed.\n'
                f'Vehicle: {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}\n'
                f'Pickup: {booking.pickup_date} at {booking.pickup_location}\n'
                f'Return: {booking.return_date}\n\n'
                f'Please sign your rental agreement before pickup.'
            ),
            from_email     = 'noreply@carrentindia.com',
            recipient_list = [booking.customer.email],
            fail_silently  = True,
        )
    except Exception:
        pass
 
 
@shared_task
def send_pickup_reminder(booking_id: int):
    """Sent 24 hours before pickup. Scheduled via Celery Beat."""
    from .models import Booking
    try:
        booking = Booking.objects.select_related("customer").get(pk=booking_id)
        if booking.status != 'CONFIRMED':
            return
        send_mail(
            subject    = f'[CarRent India] Pickup Reminder — {booking.booking_ref}',
            message    = f'Reminder: your vehicle pickup is tomorrow on {booking.pickup_date}. Remember to carry your driving licence.',
            from_email = 'noreply@carrentindia.com',
            recipient_list = [booking.customer.email],
            fail_silently  = True,
        )
    except Exception:
        pass
 
 
@shared_task
def send_invoice_email(booking_id: int):
    """Sent after return inspection is completed."""
    from .models import Booking
    try:
        booking = Booking.objects.select_related("customer").get(pk=booking_id)
        send_mail(
            subject    = f'[CarRent India] Invoice — {booking.booking_ref}',
            message    = f'Your rental is complete. Your invoice for {booking.booking_ref} is attached to your account. Thank you for using CarRent India.',
            from_email = 'noreply@carrentindia.com',
            recipient_list = [booking.customer.email],
            fail_silently  = True,
        )
    except Exception:
        pass
