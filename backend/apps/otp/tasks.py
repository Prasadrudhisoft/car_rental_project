import logging
import requests
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTPRecord

logger = logging.getLogger(__name__)
OTP_RETRY = dict(autoretry_for=(Exception,), retry_backoff=2, retry_backoff_max=10, max_retries=3)


def _load(otp_id):
    # Skip if the OTP was already used/replaced or has expired while queued.
    return (OTPRecord.objects.select_related('user')
            .filter(pk=otp_id, is_used=False, expires_at__gt=timezone.now()).first())


def _msisdn(phone):
    digits = ''.join(c for c in (phone or '') if c.isdigit())
    if len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    if len(digits) == 10:
        digits = '91' + digits
    return digits


@shared_task(**OTP_RETRY)
def send_otp_email(otp_id):
    return
    otp = _load(otp_id)
    if not otp:
        return
    send_mail(
        subject        = f'CarRent India OTP: {otp.code}',
        message        = f'Your OTP for {otp.purpose.replace("_", " ")} is: {otp.code}. Valid for 5 minutes.',
        from_email     = settings.DEFAULT_FROM_EMAIL,
        recipient_list = [otp.user.email],
        fail_silently  = False,
    )


@shared_task(**OTP_RETRY)
def send_otp_sms(otp_id):
    return
    otp = _load(otp_id)
    if not otp:
        return
    mobile = _msisdn(otp.user.phone)
    if len(mobile) < 11:
        logger.error('SMS OTP skipped: invalid phone on user %s', otp.user_id)
        return
    resp = requests.post(
        'https://control.msg91.com/api/v5/otp',
        params={
            'template_id': settings.MSG91_TEMPLATE_ID,
            'mobile':      mobile,
            'authkey':     settings.MSG91_API_KEY,
            'otp':         otp.code,
            'otp_expiry':  5,
        },
        json={}, timeout=(3, 7),
    )
    data = resp.json()
    if resp.status_code != 200 or data.get('type') != 'success':
        logger.error('MSG91 rejected OTP for user %s: %s', otp.user_id, data)
        raise RuntimeError('MSG91 delivery failed')      # triggers retry


@shared_task
def cleanup_expired_otps():
    """Nightly housekeeping — keeps the OTP tables small (30-day audit window)."""
    from apps.bookings.models import InspectionOTP
    cutoff = timezone.now() - timedelta(days=30)
    OTPRecord.objects.filter(expires_at__lt=cutoff).delete()
    InspectionOTP.objects.filter(expires_at__lt=cutoff).delete()