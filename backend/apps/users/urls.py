from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (TokenObtainPairView,
                                             TokenRefreshView,
                                             TokenBlacklistView)
 
from .views import (CustomerRegisterView, VendorRegisterView, MeView,
                    SavedAddressViewSet, AdminVendorListView,
                    AdminVendorActionView, AdminUserListView)
from .token import CarRentTokenView
from .views import CustomerProfileView
from .views import VendorKYCUploadView, VendorProfileDetailView 
from .views import AdminDashboardStatsView 
 
router = DefaultRouter()
router.register('addresses', SavedAddressViewSet, basename='address')
 
urlpatterns = [
    # Auth
    path('login/',           CarRentTokenView.as_view(), name='login'),
    path('token/refresh/',   TokenRefreshView.as_view(),     name='token-refresh'),
    path('logout/',          TokenBlacklistView.as_view(),   name='logout'),
 
    # Registration
    path('register/customer/', CustomerRegisterView.as_view(), name='register-customer'),
    path('register/vendor/',   VendorRegisterView.as_view(),   name='register-vendor'),
 
    # Current user profile
    path('me/', MeView.as_view(), name='me'),
 
    # Saved addresses
    path('', include(router.urls)),
 
    # Admin endpoints
    path('admin/users/',                AdminUserListView.as_view(),   name='admin-users'),
    path('admin/vendors/',              AdminVendorListView.as_view(), name='admin-vendors'),
    path('admin/vendors/<int:pk>/action/', AdminVendorActionView.as_view(), name='admin-vendor-action'),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),

    path('profile/', CustomerProfileView.as_view(), name='customer-profile'),
    path('vendor/kyc/',     VendorKYCUploadView.as_view(),    name='vendor-kyc'),
    path('vendor/profile/', VendorProfileDetailView.as_view(), name='vendor-profile'),

]

# Full URL list:
# POST  /api/users/login/
# POST  /api/users/token/refresh/
# POST  /api/users/logout/
# POST  /api/users/register/customer/
# POST  /api/users/register/vendor/
# GET   /api/users/me/
# PATCH /api/users/me/
# GET   /api/users/addresses/
# POST  /api/users/addresses/
# GET   /api/users/admin/users/
# GET   /api/users/admin/vendors/
# POST  /api/users/admin/vendors/{id}/action/
