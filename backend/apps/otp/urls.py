from django.urls import path
from .views import SendOTPView, VerifyOTPView
 
urlpatterns = [
    path('send/',   SendOTPView.as_view(),   name='otp-send'),
    path('verify/', VerifyOTPView.as_view(),  name='otp-verify'),
]
 
# POST /api/otp/send/   -> generate and send OTP
# POST /api/otp/verify/ -> check OTP code
