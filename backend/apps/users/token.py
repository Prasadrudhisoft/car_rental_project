from django.contrib.auth.models import update_last_login
from rest_framework import serializers
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView

from .backends import find_login_matches


class AccountChoiceRequired(APIException):
    status_code = 400
    default_code = 'role_required'
    default_detail = {
        'detail': 'This email is registered for more than one account type. Please choose Customer, Vendor or Admin.',
        'code': 'role_required',
    }


class CarRentTokenSerializer(TokenObtainPairSerializer):
    """Login by email + password, with an optional `role` to pick between accounts sharing an email."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['role'] = serializers.ChoiceField(
            choices=['customer', 'vendor', 'admin'], required=False, allow_blank=True, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role']      = user.role
        token['full_name'] = user.full_name
        return token

    def validate(self, attrs):
        matches = find_login_matches(attrs.get('email'), attrs.get('password'), attrs.get('role') or None)
        if not matches:
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')
        if len(matches) > 1:
            raise AccountChoiceRequired()

        self.user = matches[0]
        refresh = self.get_token(self.user)
        data = {'refresh': str(refresh), 'access': str(refresh.access_token)}
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)
        data['role']      = self.user.role
        data['full_name'] = self.user.full_name
        data['user_id']   = self.user.id
        return data


class CarRentTokenView(TokenObtainPairView):
    serializer_class = CarRentTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope   = 'auth'