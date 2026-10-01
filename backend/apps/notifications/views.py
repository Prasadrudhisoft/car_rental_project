from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer, AdminSendNotificationSerializer
from django.db.models import Count, Max, Min, Q
from django.db.models.functions import TruncMinute
from datetime import timezone as dt_utc
from car_rent.async_utils import enqueue
from .tasks import broadcast_notification
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
        agg = Notification.objects.filter(recipient=request.user).aggregate(
            unread=Count('id', filter=Q(is_read=False)), latest=Max('id'))
        return Response({'unread_count': agg['unread'] or 0, 'latest_id': agg['latest']})

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
            return Response({'message': 'Notification sent to 1 user(s).', 'recipient_count': 1}, status=201)

        count = None
        if v['target_type'] == 'segment':
            from apps.personalization.models import Segment
            get_object_or_404(Segment, pk=v['segment_id'])
        elif v['target_type'] == 'role':
            count = User.objects.filter(role=v['role']).count()
        else:
            count = User.objects.count()

        # Fan-out happens in a worker: one request must never insert 100k rows inline.
        enqueue(broadcast_notification, v['target_type'], v['title'], v['message'],
                v.get('link_url', ''), request.user.id, v.get('role'), v.get('segment_id'))
        msg = f'Notification queued for {count} user(s).' if count is not None \
              else 'Notification queued for all matching customers.'
        return Response({'message': msg, 'recipient_count': count}, status=202)


class AdminSentListView(generics.ListAPIView):
    """
    GET /api/notifications/admin/sent/
    Audit log of admin-authored broadcasts (deduplicated by title+message+timestamp
    since notify_bulk creates one row per recipient).
    """
    permission_classes = [IsAdminRole]
    serializer_class   = NotificationSerializer
    
    def get_queryset(self):
        first_ids = (
            Notification.objects.filter(notification_type='admin_broadcast')
            .annotate(batch=TruncMinute('created_at', tzinfo=dt_utc.utc))
            .values('title', 'message', 'batch')
            .annotate(first_id=Min('id'))
            .values_list('first_id', flat=True)
        )
        return Notification.objects.filter(id__in=first_ids).order_by('-created_at')