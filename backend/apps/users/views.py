from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
 
from .models import CustomerProfile, VendorProfile, SavedAddress
from .serializers import (CustomerRegisterSerializer, VendorRegisterSerializer,
                           UserMeSerializer, VendorProfileFullSerializer,
                           SavedAddressSerializer)
 
User = get_user_model()
 
 
# ── Role-based permission helpers ────────────────────────────────────────
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'
 
class IsVendorRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'vendor'
 
class IsCustomerRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'customer'
 
 
# ── Registration ─────────────────────────────────────────────────────────
class CustomerRegisterView(generics.CreateAPIView):
    """POST /api/users/register/customer/ — create a new customer account"""
    serializer_class   = CustomerRegisterSerializer
    permission_classes = [permissions.AllowAny]
 
    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        # Issue tokens immediately so the user is logged in after registering
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Customer account created.',
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserMeSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
 
 
class VendorRegisterView(generics.CreateAPIView):
    """POST /api/users/register/vendor/ — create a new vendor account (pending approval)"""
    serializer_class   = VendorRegisterSerializer
    permission_classes = [permissions.AllowAny]
 
    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response({
            'message': 'Vendor account created. Pending admin approval.',
            'user_id': user.id,
        }, status=status.HTTP_201_CREATED)
 
 
# ── Current user (me) ────────────────────────────────────────────────────
class MeView(APIView):
    """GET /api/users/me/ — return the logged-in user's profile"""
    permission_classes = [permissions.IsAuthenticated]
 
    def get(self, request):
        return Response(UserMeSerializer(request.user).data)
 
    def patch(self, request):
        s = UserMeSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)
 
 
# ── Saved Addresses (Customer) ────────────────────────────────────────────
class SavedAddressViewSet(viewsets.ModelViewSet):
    """CRUD for /api/users/addresses/ — customer's saved pickup locations"""
    serializer_class   = SavedAddressSerializer
    permission_classes = [IsCustomerRole]
 
    def get_queryset(self):
        return SavedAddress.objects.filter(customer=self.request.user.customer_profile)
 
    def perform_create(self, serializer):
        serializer.save(customer=self.request.user.customer_profile)
 
 
# ── Admin — Vendor Approval ───────────────────────────────────────────────
class AdminVendorListView(generics.ListAPIView):
    """
    GET /api/users/admin/vendors/
 
    BUG FIX: was using VendorProfileSerializer which omits kyc_document,
    aadhaar_number, pan_number, bank details, and full address fields.
    Admin could not see any of these in the vendor list response.
    """
    serializer_class   = VendorProfileFullSerializer   # ← THE FIX
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        qs = VendorProfile.objects.select_related('user', 'city').all()
        status_filter = self.request.query_params.get('status')
        search        = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(business_name__icontains=search)
        return qs
 
 
class AdminVendorActionView(APIView):
    """
    POST /api/users/admin/vendors/{id}/action/
    Body: { 'action': 'approve' | 'reject' | 'more_info', 'note': '...' }
    """
    permission_classes = [IsAdminRole]
 
    def post(self, request, pk):
        vendor = get_object_or_404(VendorProfile, pk=pk)
        action = request.data.get('action')
        note   = request.data.get('note', '')
        valid  = {'approve':'approved','reject':'rejected','more_info':'more_info'}
        if action not in valid:
            return Response({'error':'Invalid action.'}, status=400)
        vendor.status     = valid[action]
        vendor.admin_note = note
        vendor.save()
        return Response({'message': f'Vendor status set to {vendor.status}.'})
 
 
class AdminUserListView(generics.ListAPIView):
    """
    GET /api/users/admin/users/
    Lists users filterable by role.
 
    When role=customer (the default for the admin Users tab):
        Uses AdminCustomerSerializer — includes profile + booking stats.
    Otherwise:
        Uses UserMeSerializer (admins/vendors don't have CustomerProfile).
    """
    permission_classes = [IsAdminRole]
 
    def get_serializer_class(self):
        role = self.request.query_params.get('role', '')
        if role == 'customer':
            from .serializers import AdminCustomerSerializer
            return AdminCustomerSerializer
        return UserMeSerializer
 
    def get_queryset(self):
        qs     = User.objects.all()
        role   = self.request.query_params.get('role')
        search = self.request.query_params.get('search')
 
        if role:
            qs = qs.filter(role=role)
        if search:
            qs = qs.filter(full_name__icontains=search)
 
        # Prefetch profile for efficient access when role=customer
        if role == 'customer':
            qs = qs.select_related('customer_profile').prefetch_related(
                'bookings_as_customer'
            )
 
        return qs
 


class CustomerProfileView(APIView):
    """
    GET  /api/users/profile/  — return customer's full profile
    PATCH /api/users/profile/ — update driving licence, KYC fields
    """
    permission_classes = [IsCustomerRole]
 
    def get(self, request):
        from .serializers import CustomerProfileSerializer
        profile = request.user.customer_profile
        return Response(CustomerProfileSerializer(profile).data)
 
    def patch(self, request):
        from .serializers import CustomerProfileSerializer
        profile = request.user.customer_profile
        s = CustomerProfileSerializer(profile, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class VendorKYCUploadView(APIView):
    """
    PATCH /api/users/vendor/kyc/
    Vendor submits KYC details including a document upload.
 
    BUG FIX: parser_classes was absent. DRF's default parsers are
    JSONParser + FormParser — neither populates request.FILES.
    Without MultiPartParser the uploaded file was silently discarded
    on every single request, so kyc_document was never written to disk.
    """
    permission_classes = [IsVendorRole]
    parser_classes     = [__import__("rest_framework.parsers", fromlist=["MultiPartParser"]).MultiPartParser,
                          __import__("rest_framework.parsers", fromlist=["FormParser"]).FormParser,
                          __import__("rest_framework.parsers", fromlist=["JSONParser"]).JSONParser]
 
    def patch(self, request):
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        from .serializers import VendorKYCSerializer
        vendor = request.user.vendor_profile
        s = VendorKYCSerializer(vendor, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response({
            'message': 'KYC documents submitted. Admin will review within 24 hours.',
            'status':  vendor.status,
        })
 
class VendorProfileDetailView(APIView):
    """
    GET /api/users/vendor/profile/
 
    BUG FIX: was using VendorProfileSerializer which does not include
    'kyc_document' in its fields list. The file was stored on disk but
    the URL was never returned, so the frontend always showed "Missing".
    """
    permission_classes = [IsVendorRole]
 
    def get(self, request):
        from .serializers import VendorProfileFullSerializer
        return Response(VendorProfileFullSerializer(request.user.vendor_profile).data)
 


class AdminDashboardStatsView(APIView):
    """
    GET /api/users/admin/stats/
    Returns quick counts for the admin dashboard overview.
    Example response:
        { 'total_customers': 120, 'total_vendors': 34,
          'pending_vendors': 5, 'approved_vendors': 28 }
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        return Response({
            'total_customers':  User.objects.filter(role='customer').count(),
            'total_vendors':    User.objects.filter(role='vendor').count(),
            'pending_vendors':  VendorProfile.objects.filter(status='pending').count(),
            'approved_vendors': VendorProfile.objects.filter(status='approved').count(),
            'rejected_vendors': VendorProfile.objects.filter(status='rejected').count(),
        })
