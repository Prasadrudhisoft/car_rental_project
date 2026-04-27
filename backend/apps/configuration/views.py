from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
 
from .models import ConfigSetting, VehicleSegmentConfig, ConfigChangeLog
from .serializers import (ConfigSettingSerializer, VehicleSegmentConfigSerializer,
                           ConfigChangeLogSerializer)
from .utils import invalidate_config_cache
 
 
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user,'role',None)=='admin'
 
 
class ConfigSettingViewSet(viewsets.ModelViewSet):
    """
    GET  /api/config/settings/              -> list all settings
    GET  /api/config/settings/?category=pricing -> filter by category
    PATCH /api/config/settings/{id}/        -> update a value
    GET  /api/config/settings/{id}/history/ -> view change history
    """
    serializer_class   = ConfigSettingSerializer
    permission_classes = [IsAdminRole]
    http_method_names  = ['get', 'patch', 'head', 'options']
 
    def get_queryset(self):
        qs  = ConfigSetting.objects.select_related('category').all()
        cat = self.request.query_params.get('category')
        return qs.filter(category__slug=cat) if cat else qs
 
    def perform_update(self, serializer):
        old = serializer.instance.value
        obj = serializer.save()
        ConfigChangeLog.objects.create(
            setting=obj, changed_by=self.request.user,
            old_value=old, new_value=obj.value,
            change_reason=self.request.data.get('change_reason',''),
        )
        invalidate_config_cache(obj.key)
 
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        logs = self.get_object().history.select_related('changed_by').all()[:50]
        return Response(ConfigChangeLogSerializer(logs, many=True).data)
 
 
class VehicleSegmentConfigViewSet(viewsets.ModelViewSet):
    queryset           = VehicleSegmentConfig.objects.all()
    serializer_class   = VehicleSegmentConfigSerializer
    permission_classes = [IsAdminRole]
