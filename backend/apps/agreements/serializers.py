from rest_framework import serializers
from .models import AgreementVersion, AgreementAcceptance


class AgreementVersionPublicSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for customers — exposes content + metadata.
    Does NOT expose internal admin fields like created_by.
    """
    acceptance_count = serializers.SerializerMethodField()

    class Meta:
        model  = AgreementVersion
        fields = [
            'id', 'version_tag', 'title', 'content', 'summary',
            'is_active', 'effective_from', 'acceptance_count',
        ]

    def get_acceptance_count(self, obj):
        return obj.acceptances.count()


class AgreementVersionAdminSerializer(serializers.ModelSerializer):
    """
    Full serializer for admins — includes audit fields and acceptance counts.
    """
    acceptance_count = serializers.SerializerMethodField()
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default='')

    class Meta:
        model  = AgreementVersion
        fields = [
            'id', 'version_tag', 'title', 'content', 'summary',
            'is_active', 'effective_from',
            'created_by', 'created_by_email', 'created_at', 'updated_at',
            'acceptance_count',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by_email']

    def get_acceptance_count(self, obj):
        return obj.acceptances.count()

    def validate_version_tag(self, value):
        # Enforce format like v1.0, v2.3-rc, etc.
        if not value.startswith('v'):
            raise serializers.ValidationError("Version tag must start with 'v', e.g. 'v1.0'.")
        return value


class AgreementAcceptanceSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for a customer's acceptance history.
    Shown in the customer dashboard — never modifiable.
    """
    version_tag    = serializers.CharField(source='agreement_version.version_tag', read_only=True)
    version_title  = serializers.CharField(source='agreement_version.title', read_only=True)
    booking_ref    = serializers.SerializerMethodField()

    class Meta:
        model  = AgreementAcceptance
        fields = [
            'id', 'version_tag', 'version_title', 'booking_ref',
            'accepted_at', 'otp_verified', 'acceptance_method', 'ip_address',
        ]

    def get_booking_ref(self, obj):
        return obj.booking.booking_ref if obj.booking else None


class AgreementAcceptanceAdminSerializer(serializers.ModelSerializer):
    """
    Admin view — full detail including user identity and IP.
    """
    user_email     = serializers.CharField(source='user.email', read_only=True)
    user_name      = serializers.CharField(source='user.full_name', read_only=True)
    version_tag    = serializers.CharField(source='agreement_version.version_tag', read_only=True)
    booking_ref    = serializers.SerializerMethodField()

    class Meta:
        model  = AgreementAcceptance
        fields = [
            'id', 'user_email', 'user_name', 'version_tag', 'booking_ref',
            'accepted_at', 'otp_verified', 'acceptance_method',
            'ip_address', 'user_agent',
        ]

    def get_booking_ref(self, obj):
        return obj.booking.booking_ref if obj.booking else None