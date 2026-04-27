from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CityViewSet, LocationViewSet, CityPairFeeViewSet, VendorLocationsView

 
router = DefaultRouter()
router.register('cities',    CityViewSet,        basename='city')
router.register('locations', LocationViewSet,     basename='location')
router.register('fees',      CityPairFeeViewSet,  basename='city-pair-fee')
 
urlpatterns = [
    path('', include(router.urls)),
    path('vendor-locations/', VendorLocationsView.as_view(), name='vendor-locations'),
]