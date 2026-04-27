from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConfigSettingViewSet, VehicleSegmentConfigViewSet
 
router = DefaultRouter()
router.register('settings', ConfigSettingViewSet,      basename='config-setting')
router.register('segments', VehicleSegmentConfigViewSet, basename='segment-config')
 
urlpatterns = [path('', include(router.urls))]
