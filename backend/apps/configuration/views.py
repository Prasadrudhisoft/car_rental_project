from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import ConfigSetting, VehicleSegmentConfig, ConfigChangeLog, ConfigCategory
from .serializers import (ConfigSettingSerializer, VehicleSegmentConfigSerializer,
                           ConfigChangeLogSerializer, ConfigCategorySerializer)
from .utils import invalidate_config_cache


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


class ConfigCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/configuration/categories/"""
    queryset           = ConfigCategory.objects.filter(is_active=True)
    serializer_class   = ConfigCategorySerializer
    permission_classes = [IsAdminRole]


class ConfigSettingViewSet(viewsets.ModelViewSet):
    """
    GET    /api/configuration/settings/                       -> active settings (default)
    GET    /api/configuration/settings/?include_archived=true  -> active + archived
    GET    /api/configuration/settings/?category=pricing
    GET    /api/configuration/settings/?search=gst
    POST   /api/configuration/settings/                        -> create (key auto-generated)
    PATCH  /api/configuration/settings/{id}/                   -> edit value (accepts change_reason)
    POST   /api/configuration/settings/{id}/archive/           -> soft-delete (blocked for system settings)
    POST   /api/configuration/settings/{id}/restore/           -> undo an archive
    DELETE /api/configuration/settings/{id}/                   -> permanent delete (only if already archived,
                                                                    and never for system settings)
    GET    /api/configuration/settings/{id}/history/           -> change history
    """
    serializer_class   = ConfigSettingSerializer
    permission_classes = [IsAdminRole]
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = ConfigSetting.objects.select_related('category').all()
        if self.request.query_params.get('include_archived') != 'true':
            qs = qs.filter(is_active=True)
        cat    = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if cat:
            qs = qs.filter(category__slug=cat)
        if search:
            qs = qs.filter(Q(key__icontains=search) | Q(display_name__icontains=search))
        return qs

    def perform_update(self, serializer):
        old = serializer.instance.value
        obj = serializer.save()
        if obj.value != old:
            ConfigChangeLog.objects.create(
                setting=obj, changed_by=self.request.user,
                old_value=old, new_value=obj.value,
                change_reason=self.request.data.get('change_reason', ''),
            )
        invalidate_config_cache(obj.key)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Soft-delete: hides the setting from normal use but keeps its full history."""
        setting = self.get_object()
        if setting.is_system:
            raise PermissionDenied(
                'This is a core system setting required for platform pricing/logic and cannot '
                'be archived. You can still edit its value.'
            )
        if not setting.is_active:
            return Response({'message': 'Already archived.'})
        setting.is_active = False
        setting.save(update_fields=['is_active'])
        ConfigChangeLog.objects.create(
            setting=setting, changed_by=request.user,
            old_value=setting.value, new_value=setting.value,
            change_reason=request.data.get('change_reason', 'Setting archived.'),
        )
        invalidate_config_cache(setting.key)
        return Response({'message': f'"{setting.display_name}" archived. It can be restored at any time.'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Undo an archive."""
        setting = ConfigSetting.objects.get(pk=pk)  # include archived rows
        setting.is_active = True
        setting.save(update_fields=['is_active'])
        invalidate_config_cache(setting.key)
        return Response({'message': f'"{setting.display_name}" restored.'})

    def get_object(self):
        # archive/restore need to reach archived rows too, but the default
        # get_queryset() hides them — override lookup for detail actions.
        if self.action in ('archive', 'restore', 'retrieve', 'partial_update', 'update', 'destroy'):
            obj = ConfigSetting.objects.select_related('category').get(pk=self.kwargs['pk'])
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def perform_destroy(self, instance):
        if instance.is_system:
            raise PermissionDenied('This is a core system setting and can never be deleted.')
        if instance.is_active:
            raise PermissionDenied(
                'Archive this setting first, then delete it permanently from the Archived list. '
                'This two-step process prevents accidental data loss.'
            )
        key = instance.key
        instance.delete()
        invalidate_config_cache(key)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        setting = ConfigSetting.objects.get(pk=pk)
        logs = setting.history.select_related('changed_by').all()[:50]
        return Response(ConfigChangeLogSerializer(logs, many=True).data)


class VehicleSegmentConfigViewSet(viewsets.ModelViewSet):
    queryset           = VehicleSegmentConfig.objects.all()
    serializer_class   = VehicleSegmentConfigSerializer
    permission_classes = [IsAdminRole]

    def perform_update(self, serializer):
        serializer.save()
        invalidate_config_cache()  # clears cfg: and seg: caches so pricing reflects the change immediately

    def perform_create(self, serializer):
        serializer.save()
        invalidate_config_cache()