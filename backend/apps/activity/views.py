from datetime import datetime, time

from django.utils import timezone
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import ActivityLog


class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (getattr(u, 'role', '') == 'admin' or u.is_superuser))


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ['id', 'created_at', 'actor_label', 'actor_role', 'action', 'module',
                  'entity_type', 'entity_id', 'summary', 'old_values', 'new_values', 'ip_address',
                  'request_id', 'http_method', 'path']


class LogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _parse_date(s, end=False):
    try:
        d = datetime.strptime(s, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None
    return timezone.make_aware(datetime.combine(d, time.max if end else time.min))


class ActivityLogListView(ListAPIView):
    """Read-only. No POST/PUT/PATCH/DELETE exist on this route."""
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class = ActivityLogSerializer
    pagination_class = LogPagination

    def get_queryset(self):
        p = self.request.query_params
        qs = ActivityLog.objects.all()
        if p.get('user'):
            qs = qs.filter(actor_label__icontains=p['user'])
        if p.get('role'):
            qs = qs.filter(actor_role=p['role'])
        if p.get('module'):
            qs = qs.filter(module=p['module'])
        if p.get('action'):
            qs = qs.filter(action=p['action'])
        if p.get('entity_id'):
            qs = qs.filter(entity_id=p['entity_id'])
        if p.get('q'):
            qs = qs.filter(summary__icontains=p['q'])
        start, end = _parse_date(p.get('from')), _parse_date(p.get('to'), end=True)
        if start:
            qs = qs.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lte=end)
        return qs


class ActivityLogMetaView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        return Response({
            'modules': [{'value': v, 'label': l} for v, l in ActivityLog.MODULES],
            'actions': [{'value': v, 'label': l} for v, l in ActivityLog.ACTIONS],
            'roles': ['customer', 'vendor', 'admin'],
            'retention_days': 30,
        })
