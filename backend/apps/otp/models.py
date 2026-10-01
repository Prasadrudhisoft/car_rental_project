import random
from django.db import models, transaction
from django.utils import timezone
from datetime import timedelta
import secrets
from django.contrib.auth import get_user_model
 
User = get_user_model()
 
 
class OTPRecord(models.Model):
    """
    SQL table: otp_record
    One row per OTP sent. Expired and used OTPs are kept for audit.
    Purposes:
      login          -> log in without password
      phone_verify   -> verify phone number at registration
      agreement_sign -> sign the rental agreement
      inspection_sign -> sign the pickup or return inspection report
    """
    PURPOSES = [
        ('login',           'Login'),
        ('phone_verify',    'Phone Verification'),
        ('email_verify',    'Email Verification'),
        ('agreement_sign',  'Agreement Sign-Off'),
        ('inspection_sign', 'Inspection Sign-Off'),
    ]
 
    user       = models.ForeignKey(User, on_delete=models.CASCADE,
                                   related_name='otps')
    code       = models.CharField(max_length=6)
    purpose    = models.CharField(max_length=30, choices=PURPOSES)
    is_used    = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'otp_record'
        ordering = ['-created_at']
 
    @classmethod
    def generate(cls, user, purpose):
        """Create a new OTP; any previous unused OTP for the same purpose is invalidated atomically."""
        # code = f'{secrets.randbelow(900000) + 100000}'
        code = '123456' # TEMP hardcoded 
        with transaction.atomic():
            cls.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)
            return cls.objects.create(
                user=user, code=code, purpose=purpose,
                expires_at=timezone.now() + timedelta(minutes=5),
            )
 
    def is_valid(self):
        """Returns True if this OTP has not been used and has not expired."""
        return not self.is_used and timezone.now() < self.expires_at
