from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Notification

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')

    class Meta:
        model  = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'link_url',
                  'is_read', 'read_at', 'created_by_name', 'created_at']


class AdminSendNotificationSerializer(serializers.Serializer):
    """
    Input for admin-authored broadcasts.
    target_type:
      'user' -> requires user_id
      'role' -> requires role ('customer'|'vendor'|'admin')
      'all'  -> everyone
    """
    target_type = serializers.ChoiceField(choices=['user', 'role', 'all'])
    user_id     = serializers.IntegerField(required=False)
    role        = serializers.ChoiceField(choices=['customer', 'vendor', 'admin'], required=False)
    title       = serializers.CharField(max_length=200)
    message     = serializers.CharField()
    link_url    = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs['target_type'] == 'user' and not attrs.get('user_id'):
            raise serializers.ValidationError({'user_id': 'Required when target_type is "user".'})
        if attrs['target_type'] == 'role' and not attrs.get('role'):
            raise serializers.ValidationError({'role': 'Required when target_type is "role".'})
        return attrs