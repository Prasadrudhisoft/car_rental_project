from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from car_rent.async_utils import enqueue
from apps.users.kyc import evaluate_kyc
from .models import OTPRecord
from .tasks import send_otp_email, send_otp_sms
from datetime import timedelta
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

User = get_user_model()
KYC_PURPOSES = ('phone_verify', 'email_verify')
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 600


def _kyc_forbidden(request, email):
    """KYC OTPs may only be requested/verified by the logged-in owner of the email."""
    return (not request.user.is_authenticated
            or (email or '').lower() != request.user.email.lower())

def _resolve_user(request, email, purpose):
    """KYC OTPs always belong to the logged-in account; others only if the email is unambiguous."""
    if request.user.is_authenticated and (email or '').lower() == request.user.email.lower():
        return request.user
    if purpose in KYC_PURPOSES:
        return None
    users = list(User.objects.filter(email__iexact=email)[:2])
    return users[0] if len(users) == 1 else None


class SendOTPView(APIView):
    """POST /api/otp/send/  Body: { email, purpose }
    phone_verify -> SMS to the account's phone (MSG91); everything else -> email."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'otp_send'

    def post(self, request):
        email   = request.data.get('email')
        purpose = request.data.get('purpose')
        valid_purposes = ['login', 'phone_verify', 'email_verify', 'inspection_sign']

        if not email or not purpose:
            return Response({'error': 'email and purpose are required.'}, status=400)
        if purpose not in valid_purposes:
            return Response({'error': f'purpose must be one of {valid_purposes}.'}, status=400)
        if purpose in KYC_PURPOSES and _kyc_forbidden(request, email):
            return Response({'error': 'Not authorised.'}, status=403)
        # if purpose == 'phone_verify' and not (settings.MSG91_API_KEY and settings.MSG91_TEMPLATE_ID):
        #     return Response({'error': 'SMS service is not configured.'}, status=503)

        user = _resolve_user(request, email, purpose)
        if user is None:
            return Response({'message': 'If this account exists, an OTP has been sent.'})

        otp = OTPRecord.generate(user, purpose)
        # Delivery happens in a Celery worker — the request returns immediately.
        enqueue(send_otp_sms if purpose == 'phone_verify' else send_otp_email, otp.id)

        target = 'your registered phone number' if purpose == 'phone_verify' else 'your email'
        return Response({'message': f'OTP sent to {target}. Valid for 5 minutes.'})


class VerifyOTPView(APIView):
    """POST /api/otp/verify/  Body: { email, code, purpose }"""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'otp_verify'

    def post(self, request):
        email   = request.data.get('email')
        code    = request.data.get('code')
        purpose = request.data.get('purpose')

        if not all([email, code, purpose]):
            return Response({'error': 'email, code, and purpose are required.'}, status=400)
        if purpose in KYC_PURPOSES and _kyc_forbidden(request, email):
            return Response({'error': 'Not authorised.'}, status=403)

        fail_key = f'otpfail:{purpose}:{email.lower()}'
        if cache.get(fail_key, 0) >= MAX_FAILED_ATTEMPTS:
            return Response({'error': 'Too many wrong attempts. Please request a new OTP in a few minutes.'}, status=429)

        user = _resolve_user(request, email, purpose)
        otp = (OTPRecord.objects.filter(user=user, code=code, purpose=purpose, is_used=False)
               .order_by('-created_at').first()) if user else None
        if otp is None:
            cache.add(fail_key, 0, LOCKOUT_SECONDS)
            cache.incr(fail_key)
            return Response({'error': 'Invalid OTP.'}, status=400)

        if not otp.is_valid():
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=400)

        otp.is_used = True
        otp.save(update_fields=['is_used'])
        cache.delete(fail_key)

        if purpose == 'phone_verify':
            user.is_phone_verified = True
            user.save(update_fields=['is_phone_verified'])
        elif purpose == 'email_verify':
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])
        if purpose in KYC_PURPOSES:
            evaluate_kyc(user)

        return Response({'valid': True, 'message': 'OTP verified successfully.'})



def _accounts(email, role=None):
    """Active accounts with this email (the same email may exist once per role)."""
    qs = User.objects.filter(email__iexact=(email or '').strip(), is_active=True)
    if role:
        qs = qs.filter(role=role)
    return list(qs)


def _issue_reset_otp(user):
    code = '123456'   # TEMP: hardcoded OTP for local testing — replace with secrets-generated code before production
    with transaction.atomic():
        OTPRecord.objects.filter(user=user, purpose='password_reset', is_used=False).update(is_used=True)
        return OTPRecord.objects.create(
            user=user, code=code, purpose='password_reset',
            expires_at=timezone.now() + timedelta(minutes=5),
        )


class PasswordResetRequestView(APIView):
    """POST /api/otp/password-reset/request/  { email, role? }  — always answers generically."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'otp_send'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        users = _accounts(email, request.data.get('role') or None)
        if users:
            otp = _issue_reset_otp(users[0])
            enqueue(send_otp_email, otp.id)          # emailed by the Celery worker
        return Response({'message': 'If an account exists for this email, a 6-digit code has been sent.'})


class PasswordResetConfirmView(APIView):
    """POST /api/otp/password-reset/confirm/  { email, code, new_password, role? }"""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'otp_verify'

    def post(self, request):
        email    = (request.data.get('email') or '').strip()
        code     = request.data.get('code')
        new_pw   = request.data.get('new_password') or ''
        if not (email and code and new_pw):
            return Response({'error': 'email, code and new_password are required.'}, status=400)

        fail_key = f'otpfail:password_reset:{email.lower()}'
        if cache.get(fail_key, 0) >= MAX_FAILED_ATTEMPTS:
            return Response({'error': 'Too many wrong attempts. Request a new code in a few minutes.'}, status=429)

        users = _accounts(email, request.data.get('role') or None)
        otp = (OTPRecord.objects.filter(user__in=users, code=code, purpose='password_reset', is_used=False)
               .order_by('-created_at').first()) if users else None
        if otp is None:
            cache.add(fail_key, 0, LOCKOUT_SECONDS)
            cache.incr(fail_key)
            return Response({'error': 'Invalid or expired code.'}, status=400)
        if not otp.is_valid():
            return Response({'error': 'This code has expired. Request a new one.'}, status=400)

        try:                                           # validate BEFORE consuming the code so the user can retry
            validate_password(new_pw, user=users[0])
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=400)

        with transaction.atomic():
            otp.is_used = True
            otp.save(update_fields=['is_used'])
            for u in users:
                u.set_password(new_pw)
                u.save(update_fields=['password'])

        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for t in OutstandingToken.objects.filter(user__in=users):   # sign out every existing session
            BlacklistedToken.objects.get_or_create(token=t)

        cache.delete(fail_key)
        return Response({'message': 'Password updated. You can now sign in.'})