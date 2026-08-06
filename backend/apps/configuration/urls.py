from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConfigSettingViewSet, VehicleSegmentConfigViewSet, ConfigCategoryViewSet

router = DefaultRouter()
router.register('settings',   ConfigSettingViewSet,       basename='config-setting')
router.register('segments',   VehicleSegmentConfigViewSet, basename='segment-config')
router.register('categories', ConfigCategoryViewSet,      basename='config-category')

urlpatterns = [path('', include(router.urls))]