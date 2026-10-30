from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminApproveVehicleEditView,
    VendorVehicleViewSet,
    VehicleDocUploadView,
    VehiclePhotoUploadView,
    AdminVehicleListView,
    AdminDocReviewView,
    AdminVehicleBlacklistView,
    AdminVehicleSetStatusView,
    VehicleQRScanView,
    VehicleQRTamperFlagView,
    VehicleSearchView,
    VehicleSegmentSearchView,
    VehicleDetailPublicView,
    AvailabilityView,
    VehicleAdminStatsView,
    VAHANCheckView,
    AdminCompleteReverificationView,
    AdminRejectVehicleEditView,
)
 
router = DefaultRouter()
router.register('vendor', VendorVehicleViewSet, basename='vendor-vehicle')
 
urlpatterns = [
    path("", include(router.urls)),
 
    # Public
    path('segments/',                                  VehicleSegmentSearchView.as_view(),  name='vehicle-segments'),
    path('search/',                                    VehicleSearchView.as_view(),       name='vehicle-search'),
    path('<int:pk>/',                                  VehicleDetailPublicView.as_view(),  name='vehicle-detail'),
    path('qr/<str:vehicle_id_code>/',                 VehicleQRScanView.as_view(),        name='vehicle-qr'),
 
    # Vendor
    path('<int:vehicle_id>/docs/upload/',              VehicleDocUploadView.as_view(),     name='doc-upload'),
    path('<int:vehicle_id>/photos/upload/',            VehiclePhotoUploadView.as_view(),   name='photo-upload'),
    path('<int:vehicle_id>/availability/',             AvailabilityView.as_view(),         name='availability'),
 
    # Admin
    path('admin/',                                     AdminVehicleListView.as_view(),     name='admin-vehicle-list'),
    path('admin/stats/',                               VehicleAdminStatsView.as_view(),    name='admin-vehicle-stats'),
    path('admin/docs/<int:doc_id>/review/',            AdminDocReviewView.as_view(),       name='admin-doc-review'),
    path('admin/<int:vehicle_id>/blacklist/',          AdminVehicleBlacklistView.as_view(),name='admin-blacklist'),
    path('admin/<int:vehicle_id>/set-status/',         AdminVehicleSetStatusView.as_view(), name='admin-set-status'),
    path('admin/<int:vehicle_id>/flag-qr/',            VehicleQRTamperFlagView.as_view(), name='admin-flag-qr'),
    path('admin/<int:vehicle_id>/vahan-check/',        VAHANCheckView.as_view(), name='admin-vahan-check'),
    path('admin/<int:vehicle_id>/approve-edit/',
         AdminApproveVehicleEditView.as_view(),       name='admin-approve-edit'),
    path('admin/<int:vehicle_id>/reject-edit/',
         AdminRejectVehicleEditView.as_view(),        name='admin-reject-edit'),
    path('admin/<int:vehicle_id>/complete-reverification/',
         AdminCompleteReverificationView.as_view(),   name='admin-complete-reverify'),
]

