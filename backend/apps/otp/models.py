import random
from django.db import models
from django.utils import timezone
from datetime import timedelta
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
        """
        Create a new OTP for the user.
        Any previous unused OTPs for the same purpose are invalidated.
        """
        # Invalidate old unused OTPs for this user+purpose
        cls.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)
        code = str(random.randint(100000, 999999))
        return cls.objects.create(
            user=user,
            code=code,
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
 
    def is_valid(self):
        """Returns True if this OTP has not been used and has not expired."""
        return not self.is_used and timezone.now() < self.expires_at
