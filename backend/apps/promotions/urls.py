from django.urls import path
from .views import AdminPromoViewSet, AdminPromoDetailView

urlpatterns = [
    path('admin/',          AdminPromoViewSet.as_view(),     name='admin-promo-list'),
    path('admin/<int:pk>/', AdminPromoDetailView.as_view(), name='admin-promo-detail'),
]