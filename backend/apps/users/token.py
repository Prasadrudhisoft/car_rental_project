from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.throttling import ScopedRateThrottle
 
 
class CarRentTokenSerializer(TokenObtainPairSerializer):
    """
    Adds role, full_name, and user_id to the standard JWT login response.
    The frontend uses 'role' to decide which dashboard to open after login.
    """
 
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Embed non-sensitive data directly in the token
        token['role']      = user.role
        token['full_name'] = user.full_name
        return token
 
    def validate(self, attrs):
        data = super().validate(attrs)
        # Also include them in the response body for convenience
        data['role']      = self.user.role
        data['full_name'] = self.user.full_name
        data['user_id']   = self.user.id
        return data
 
 
class CarRentTokenView(TokenObtainPairView):
    serializer_class = CarRentTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope   = 'auth'