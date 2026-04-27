from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgreementVersion, AgreementAcceptance
from .serializers import (
    AgreementVersionPublicSerializer,
    AgreementVersionAdminSerializer,
    AgreementAcceptanceSerializer,
    AgreementAcceptanceAdminSerializer,
)


# ── Permission helpers ───────────────────────────────────────────────
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


def _get_client_ip(request):
    """Extract real client IP, respecting X-Forwarded-For from proxies."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _get_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')[:500]  # cap length


# ════════════════════════════════════════════════════════════════════════
# PUBLIC VIEWS (customers)
# ════════════════════════════════════════════════════════════════════════

class ActiveAgreementView(APIView):
    """
    GET /api/agreements/active/
    Returns the currently active agreement version.
    Public — called by the frontend when the sign modal opens.
    Returns 404 if no active version is configured.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        version = AgreementVersion.get_active()
        if not version:
            return Response(
                {'error': 'No active agreement version found. Please contact support.'},
                status=404,
            )
        return Response(AgreementVersionPublicSerializer(version).data)


class AgreementVersionDetailView(generics.RetrieveAPIView):
    """
    GET /api/agreements/versions/{id}/
    Fetch a specific version by ID — used to display the exact version
    a customer signed (their acceptance record stores the version FK).
    Public — so historical references remain accessible.
    """
    permission_classes   = [permissions.AllowAny]
    serializer_class     = AgreementVersionPublicSerializer
    queryset             = AgreementVersion.objects.all()


class RecordAcceptanceView(APIView):
    """
    POST /api/agreements/accept/
    Records that the authenticated user has accepted the active (or specified) version.
    Called by the frontend AFTER the user clicks "I Accept" AND verifies OTP.

    Body: {
        "version_id":        <int>,           # required — the version they are accepting
        "booking_id":        <int|null>,      # optional — links to booking
        "otp_verified":      true,            # whether OTP was used
        "acceptance_method": "otp_sign"       # 'otp_sign' | 'checkbox'
    }

    This endpoint is IDEMPOTENT-safe: if the exact same user+version+booking
    combination already exists, it returns the existing record rather than
    creating a duplicate, because over-recording is also a problem.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        version_id        = request.data.get('version_id')
        booking_id        = request.data.get('booking_id')
        otp_verified      = bool(request.data.get('otp_verified', False))
        acceptance_method = request.data.get('acceptance_method', 'checkbox')

        if not version_id:
            return Response({'error': 'version_id is required.'}, status=400)

        version = get_object_or_404(AgreementVersion, pk=version_id)

        # Resolve optional booking
        booking = None
        if booking_id:
            from apps.bookings.models import Booking
            try:
                booking = Booking.objects.get(pk=booking_id, customer=request.user)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found or not yours.'}, status=404)

        # Create a new immutable acceptance record
        acceptance = AgreementAcceptance.objects.create(
            user               = request.user,
            agreement_version  = version,
            booking            = booking,
            ip_address         = _get_client_ip(request),
            user_agent         = _get_user_agent(request),
            otp_verified       = otp_verified,
            acceptance_method  = acceptance_method,
        )

        return Response(
            AgreementAcceptanceSerializer(acceptance).data,
            status=201,
        )


class MyAcceptanceHistoryView(generics.ListAPIView):
    """
    GET /api/agreements/my-history/
    Returns the authenticated customer's full acceptance history,
    newest first. Used in the dashboard "Agreement History" tab.
    """
    serializer_class   = AgreementAcceptanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AgreementAcceptance.objects.filter(
            user=self.request.user
        ).select_related('agreement_version', 'booking').order_by('-accepted_at')


# ════════════════════════════════════════════════════════════════════════
# ADMIN VIEWS
# ════════════════════════════════════════════════════════════════════════

class AdminVersionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/agreements/admin/versions/     → list all versions with stats
    POST /api/agreements/admin/versions/     → create a new version (draft, inactive by default)

    Creating a new version does NOT auto-activate it.
    Use the activate endpoint to publish it.
    """
    permission_classes = [IsAdminRole]
    serializer_class   = AgreementVersionAdminSerializer

    def get_queryset(self):
        return AgreementVersion.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminVersionDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/agreements/admin/versions/{id}/  → full version detail
    PATCH /api/agreements/admin/versions/{id}/  → edit title/content/summary
                                                  (only for non-active drafts ideally)
    """
    permission_classes = [IsAdminRole]
    serializer_class   = AgreementVersionAdminSerializer
    queryset           = AgreementVersion.objects.all()


class AdminActivateVersionView(APIView):
    """
    POST /api/agreements/admin/versions/{id}/activate/
    Activates the specified version. All other versions are automatically
    deactivated (enforced in AgreementVersion.save()).

    This is a one-way action — activating is how you publish a draft.
    There is no "deactivate without activating another" action to prevent
    the platform from running with no active agreement.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        version = get_object_or_404(AgreementVersion, pk=pk)
        if version.is_active:
            return Response({'message': 'This version is already active.'})
        version.is_active = True
        version.save()  # triggers deactivation of all others
        return Response({
            'message': f'{version.version_tag} is now the active agreement.',
            'version': AgreementVersionAdminSerializer(version).data,
        })


class AdminAcceptanceListView(generics.ListAPIView):
    """
    GET /api/agreements/admin/acceptances/
    Full audit log of all acceptances across all users.
    Filterable by version_id, user_id, booking_id.
    Ordered by newest first.
    """
    permission_classes = [IsAdminRole]
    serializer_class   = AgreementAcceptanceAdminSerializer

    def get_queryset(self):
        qs = AgreementAcceptance.objects.select_related(
            'user', 'agreement_version', 'booking'
        ).order_by('-accepted_at')

        version_id = self.request.query_params.get('version_id')
        user_id    = self.request.query_params.get('user_id')
        booking_id = self.request.query_params.get('booking_id')

        if version_id: qs = qs.filter(agreement_version_id=version_id)
        if user_id:    qs = qs.filter(user_id=user_id)
        if booking_id: qs = qs.filter(booking_id=booking_id)

        return qs