from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer, AdminSendNotificationSerializer
from .utils import notify, notify_bulk

User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/                 -> all my notifications, newest first
    GET /api/notifications/?is_read=false    -> unread only
    """
    serializer_class   = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            qs = qs.filter(is_read=(is_read.lower() == 'true'))
        return qs


class UnreadCountView(APIView):
    """
    GET /api/notifications/unread-count/
    Polled by the frontend bell to drive the badge + trigger "new
    notification" pop-ups without needing a websocket connection.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        latest = Notification.objects.filter(recipient=request.user).order_by('-created_at').first()
        return Response({
            'unread_count': count,
            'latest_id':    latest.id if latest else None,
        })


class MarkReadView(APIView):
    """POST /api/notifications/{id}/read/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notif.is_read:
            notif.is_read = True
            notif.read_at = timezone.now()
            notif.save(update_fields=['is_read', 'read_at'])
        return Response({'message': 'Marked read.'})


class MarkAllReadView(APIView):
    """POST /api/notifications/mark-all-read/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return Response({'message': f'{updated} notification(s) marked read.'})


class AdminSendNotificationView(APIView):
    """
    POST /api/notifications/admin/send/
    Body: { target_type: 'user'|'role'|'all', user_id?, role?, title, message, link_url? }
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        s = AdminSendNotificationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data

        if v['target_type'] == 'user':
            recipient = get_object_or_404(User, pk=v['user_id'])
            notify(recipient, v['title'], v['message'], 'admin_broadcast',
                   v.get('link_url', ''), created_by=request.user)
            count = 1
        elif v['target_type'] == 'role':
            recipients = User.objects.filter(role=v['role'])
            count = notify_bulk(recipients, v['title'], v['message'], 'admin_broadcast',
                                 v.get('link_url', ''), created_by=request.user)

        elif v['target_type'] == 'segment':
            from apps.personalization.models import Segment
            from apps.personalization.facts import build_customer_facts
            from apps.personalization.engine import user_matches_segment
            segment = get_object_or_404(Segment, pk=v['segment_id'])
            customers = User.objects.filter(role='customer', is_active=True)
            recipients = [u for u in customers.iterator() if user_matches_segment(segment, build_customer_facts(u))]
            count = notify_bulk(recipients, v['title'], v['message'], 'admin_broadcast', v.get('link_url', ''), created_by=request.user)
            
        else:  # 'all'
            recipients = User.objects.all()
            count = notify_bulk(recipients, v['title'], v['message'], 'admin_broadcast',
                                 v.get('link_url', ''), created_by=request.user)

        return Response({'message': f'Notification sent to {count} user(s).', 'recipient_count': count}, status=201)


class AdminSentListView(generics.ListAPIView):
    """
    GET /api/notifications/admin/sent/
    Audit log of admin-authored broadcasts (deduplicated by title+message+timestamp
    since notify_bulk creates one row per recipient).
    """
    permission_classes = [IsAdminRole]
    serializer_class   = NotificationSerializer

    def get_queryset(self):
        # Show one representative row per broadcast "batch" rather than
        # every recipient row, so the admin sees a clean send-log.
        seen = set()
        result_ids = []
        qs = Notification.objects.filter(
            notification_type='admin_broadcast'
        ).order_by('-created_at')
        for n in qs:
            key = (n.title, n.message, n.created_at.replace(microsecond=0))
            if key not in seen:
                seen.add(key)
                result_ids.append(n.id)
        return Notification.objects.filter(id__in=result_ids).order_by('-created_at')