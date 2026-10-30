from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenBlacklistView
)
 
from .views import (
    CustomerRegisterView, VendorRegisterView, MeView,
    SavedAddressViewSet, AdminVendorActionView,
    CustomerProfileView, VendorKYCUploadView, VendorProfileDetailView,
    # Assignment system
    AdminProfileDetailView, AdminListView,
    AssignVendorView, UnassignVendorView, BulkAssignVendorsView,
    VendorAssignmentHistoryView, AllAssignmentsView, MyAssignedVendorsView,
    # Scoped views (replace old AdminVendorListView, AdminUserListView, AdminDashboardStatsView)
    ScopedAdminVendorListView, ScopedAdminUserListView, ScopedAdminDashboardStatsView, CreateAdminView
)
from .token import CarRentTokenView
 
router = DefaultRouter()
router.register('addresses', SavedAddressViewSet, basename='address')
 
urlpatterns = [
    # Auth
    path('login/',             CarRentTokenView.as_view(),      name='login'),
    path('token/refresh/',     TokenRefreshView.as_view(),      name='token-refresh'),
    path('logout/',            TokenBlacklistView.as_view(),    name='logout'),
 
    # Registration
    path('register/customer/', CustomerRegisterView.as_view(),  name='register-customer'),
    path('register/vendor/',   VendorRegisterView.as_view(),    name='register-vendor'),
 
    # Current user profile
    path('me/',                MeView.as_view(),                name='me'),
 
    # Saved addresses
    path('', include(router.urls)),
 
    # ── Admin: assignment management (superadmin only) ──────────────
    path('admin/me/',                   AdminProfileDetailView.as_view(),      name='admin-profile-me'),
    path('admin/admins/',               AdminListView.as_view(),               name='admin-list'),
    path('admin/assign-vendor/',        AssignVendorView.as_view(),            name='assign-vendor'),
    path('admin/unassign-vendor/',      UnassignVendorView.as_view(),          name='unassign-vendor'),
    path('admin/bulk-assign/',          BulkAssignVendorsView.as_view(),       name='bulk-assign-vendors'),
    path('admin/assignments/',          AllAssignmentsView.as_view(),          name='all-assignments'),
    path('admin/assignment-history/',   VendorAssignmentHistoryView.as_view(), name='assignment-history'),
    path('admin/my-vendors/',           MyAssignedVendorsView.as_view(),       name='my-assigned-vendors'),
 
    # ── Admin: scoped CRUD ────────────────────────────────────────────
    path('admin/users/',                ScopedAdminUserListView.as_view(),     name='admin-users'),
    path('admin/vendors/',              ScopedAdminVendorListView.as_view(),   name='admin-vendors'),
    path('admin/vendors/<int:pk>/action/', AdminVendorActionView.as_view(),    name='admin-vendor-action'),
    path('admin/stats/',                ScopedAdminDashboardStatsView.as_view(), name='admin-stats'),
    path('admin/create-admin/',         CreateAdminView.as_view(), name='create-admin'),
 
    # ── Customer / Vendor profiles ────────────────────────────────────
    path('profile/',           CustomerProfileView.as_view(),   name='customer-profile'),
    path('vendor/kyc/',        VendorKYCUploadView.as_view(),   name='vendor-kyc'),
    path('vendor/profile/',    VendorProfileDetailView.as_view(), name='vendor-profile'),
]