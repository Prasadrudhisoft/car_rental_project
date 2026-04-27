from django.urls import path
from .views import ValidatePromoView, AdminPromoViewSet, AdminPromoDetailView
 
urlpatterns = [
    path('validate/',       ValidatePromoView.as_view(),     name='promo-validate'),
    path('admin/',          AdminPromoViewSet.as_view(),     name='admin-promo-list'),
    path('admin/<int:pk>/', AdminPromoDetailView.as_view(), name='admin-promo-detail'),
]
# Register in main urls.py: path('api/promos/', include('apps.promotions.urls')),
