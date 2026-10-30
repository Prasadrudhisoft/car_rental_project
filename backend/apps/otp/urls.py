from django.urls import path
from .views import SendOTPView, VerifyOTPView, PasswordResetRequestView, PasswordResetConfirmView
 
urlpatterns = [
    path('send/',   SendOTPView.as_view(),   name='otp-send'),
    path('verify/', VerifyOTPView.as_view(),  name='otp-verify'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
]