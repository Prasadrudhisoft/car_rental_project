from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReturnPointListView, ReturnPointDetailView,
    VendorNetworkOptInView, VendorNetworkDeleteView, AdminNetworkListView,
    AdminManualMatchView,
    HandoverConfirmView, HandoverPhotoUploadView,
    HandoverInspectionCompleteView, HandoverRetrievalArrangedView,
    ParkingPartnerConfirmView,
    GrantSublistPermissionView, RevokeSublistPermissionView,
    AdminLogisticsOverviewView, AdminLogisticsStatsView,
    PartnerVendorHandoverListView,
    RevenueShareDetailView,
    AdminCityParkingRateViewSet, AdminVendorCommissionOverrideViewSet,  # ← NEW
)

router = DefaultRouter()
router.register('admin/parking-rates', AdminCityParkingRateViewSet, basename='admin-parking-rate')
router.register('admin/vendor-commissions', AdminVendorCommissionOverrideViewSet, basename='admin-vendor-commission')

urlpatterns = [
    path('', include(router.urls)),

    path('return-points/',                          ReturnPointListView.as_view(),              name='return-point-list'),
    path('return-points/<int:pk>/',                 ReturnPointDetailView.as_view(),            name='return-point-detail'),

    path('network/my/',                             VendorNetworkOptInView.as_view(),           name='network-my'),
    path('network/opt-in/',                         VendorNetworkOptInView.as_view(),           name='network-opt-in'),
    path('network/<int:pk>/',                       VendorNetworkDeleteView.as_view(),          name='network-delete'),
    path('network/',                                AdminNetworkListView.as_view(),             name='network-list'),

    path('handovers/<int:handover_id>/confirm/',            HandoverConfirmView.as_view(),           name='handover-confirm'),
    path('handovers/<int:handover_id>/photos/',             HandoverPhotoUploadView.as_view(),        name='handover-photo'),
    path('handovers/<int:handover_id>/inspection-complete/',HandoverInspectionCompleteView.as_view(), name='handover-inspect-complete'),
    path('handovers/<int:handover_id>/retrieval/',          HandoverRetrievalArrangedView.as_view(),  name='handover-retrieval'),
    path('handovers/<int:handover_id>/parking-confirm/',    ParkingPartnerConfirmView.as_view(),      name='parking-confirm'),
    path('handovers/<int:handover_id>/grant-sublist/',      GrantSublistPermissionView.as_view(),     name='grant-sublist'),
    path('handovers/<int:handover_id>/revoke-sublist/',     RevokeSublistPermissionView.as_view(),    name='revoke-sublist'),

    path('my-held/',                                PartnerVendorHandoverListView.as_view(),    name='my-held'),

    path('admin/overview/',                         AdminLogisticsOverviewView.as_view(),       name='admin-overview'),
    path('admin/stats/',                            AdminLogisticsStatsView.as_view(),          name='admin-stats'),
    path('admin/manual-match/',                     AdminManualMatchView.as_view(),             name='admin-manual-match'),

    path('revenue-share/<int:booking_id>/',         RevenueShareDetailView.as_view(),           name='revenue-share'),
]