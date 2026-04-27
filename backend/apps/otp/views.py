from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
 
from .models import OTPRecord
 
User = get_user_model()
 
 
def _send_otp(user, code, purpose):
    """
    In development: prints OTP to terminal (console email backend).
    In production: replace this with MSG91 API call.
    """
    from django.core.mail import send_mail
    send_mail(
        subject = f'CarRent India OTP: {code}',
        message = f'Your OTP for {purpose} is: {code}. Valid for 5 minutes.',
        from_email = 'noreply@carrentindia.com',
        recipient_list = [user.email],
        fail_silently = True,
    )
    # In dev, the OTP will appear in the VS Code terminal running Django.
 
 
class SendOTPView(APIView):
    """
    POST /api/otp/send/
    Body: { 'email': 'user@example.com', 'purpose': 'login' }
    Generates and sends a 6-digit OTP to the user's email/phone.
    """
    permission_classes = [permissions.AllowAny]
 
    def post(self, request):
        email   = request.data.get('email')
        purpose = request.data.get('purpose')
        valid_purposes = ['login','phone_verify','agreement_sign','inspection_sign']
 
        if not email or not purpose:
            return Response({'error':'email and purpose are required.'}, status=400)
        if purpose not in valid_purposes:
            return Response({'error':f'purpose must be one of {valid_purposes}.'}, status=400)
 
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Do not reveal whether email exists
            return Response({'message':'If this account exists, an OTP has been sent.'})
 
        otp = OTPRecord.generate(user, purpose)
        _send_otp(user, otp.code, purpose)
        return Response({'message':'OTP sent. Valid for 5 minutes.'})
 
 
class VerifyOTPView(APIView):
    """
    POST /api/otp/verify/
    Body: { 'email': 'user@example.com', 'code': '123456', 'purpose': 'phone_verify' }
    Returns { 'valid': true } or 400 error.
    """
    permission_classes = [permissions.AllowAny]
 
    def post(self, request):
        email   = request.data.get('email')
        code    = request.data.get('code')
        purpose = request.data.get('purpose')
 
        if not all([email, code, purpose]):
            return Response({'error':'email, code, and purpose are required.'}, status=400)
 
        try:
            user = User.objects.get(email=email)
            otp  = OTPRecord.objects.filter(
                user=user, code=code, purpose=purpose, is_used=False
            ).latest('created_at')
        except (User.DoesNotExist, OTPRecord.DoesNotExist):
            return Response({'error':'Invalid OTP.'}, status=400)
 
        if not otp.is_valid():
            return Response({'error':'OTP has expired. Please request a new one.'}, status=400)
 
        otp.is_used = True
        otp.save()
 
        # If verifying phone, mark user phone as verified
        if purpose == 'phone_verify':
            user.is_phone_verified = True
            user.save(update_fields=['is_phone_verified'])
 
        return Response({'valid': True, 'message':'OTP verified successfully.'})
