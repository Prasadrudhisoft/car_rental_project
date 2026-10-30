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

        from apps.personalization.tasks import run_event_rules_task
        from car_rent.async_utils import enqueue
        enqueue(run_event_rules_task, user.id, 'signup')

        
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
    GET   /api/users/profile/  — full profile (also self-heals KYC status)
    PATCH /api/users/profile/  — update details; KYC status is re-evaluated after every save
    """
    permission_classes = [IsCustomerRole]

    def get(self, request):
        from .serializers import CustomerProfileSerializer
        from .kyc import evaluate_kyc
        evaluate_kyc(request.user)
        profile = request.user.customer_profile
        profile.refresh_from_db()
        return Response(CustomerProfileSerializer(profile).data)

    def patch(self, request):
        from .serializers import CustomerProfileSerializer
        from .kyc import evaluate_kyc
        profile = request.user.customer_profile
        s = CustomerProfileSerializer(profile, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        evaluate_kyc(request.user)
        profile.refresh_from_db()
        return Response(CustomerProfileSerializer(profile).data)


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



from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
 
 
# ── Scope helpers ────────────────────────────────────────────────────────
 
def _get_admin_profile(user):
    """
    Superuser  -> always 'superadmin'.
    Anyone else -> 'assigned_admin' unless a superadmin explicitly changed it.
    """
    from apps.users.models import AdminProfile
    profile, _ = AdminProfile.objects.get_or_create(
        user=user,
        defaults={'scope': 'superadmin' if user.is_superuser else 'assigned_admin'},
    )
    if user.is_superuser and profile.scope != 'superadmin':
        profile.scope = 'superadmin'
        profile.save(update_fields=['scope', 'updated_at'])
    return profile
 
 
def _is_superadmin(user):
    if not (user.is_authenticated and user.role == 'admin'):
        return False
    profile = _get_admin_profile(user)
    return profile.is_superadmin
 
 
def _get_scoped_vendor_qs(request):
    """
    Returns a VendorProfile queryset scoped to the requesting admin.
    Superadmin → all vendors.
    Assigned admin → only their assigned vendors.
    """
    from apps.users.models import VendorProfile
    qs = VendorProfile.objects.select_related('user', 'city').all()
    if _is_superadmin(request.user):
        return qs
    profile = _get_admin_profile(request.user)
    vendor_ids = profile.assigned_vendor_ids
    return qs.filter(user_id__in=vendor_ids)
 
 
def _get_scoped_booking_qs(request):
    """Bookings scoped to the admin's assigned vendors."""
    from apps.bookings.models import Booking
    qs = Booking.objects.select_related('customer', 'vehicle', 'vendor').all()
    if _is_superadmin(request.user):
        return qs
    profile = _get_admin_profile(request.user)
    vendor_ids = profile.assigned_vendor_ids
    return qs.filter(vendor_id__in=vendor_ids)
 
 
def _get_scoped_customer_qs(request):
    """
    Customers scoped to those who have booked from the admin's assigned vendors.
    Superadmin → all customers.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if _is_superadmin(request.user):
        return User.objects.filter(role='customer')
    profile = _get_admin_profile(request.user)
    vendor_ids = profile.assigned_vendor_ids
    from apps.bookings.models import Booking
    customer_ids = Booking.objects.filter(
        vendor_id__in=vendor_ids
    ).values_list('customer_id', flat=True).distinct()
    return User.objects.filter(id__in=customer_ids, role='customer')
 
 
def _get_scoped_vehicle_qs(request):
    """Vehicles scoped to the admin's assigned vendors."""
    from apps.vehicles.models import Vehicle
    qs = Vehicle.objects.select_related('vendor', 'city').prefetch_related('photos', 'documents')
    if _is_superadmin(request.user):
        return qs
    profile = _get_admin_profile(request.user)
    vendor_ids = profile.assigned_vendor_ids
    return qs.filter(vendor_id__in=vendor_ids)
 
 
# ── Permission class ──────────────────────────────────────────────────────
 
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'
 
 
class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and _is_superadmin(request.user)

class CreateAdminView(APIView):
    """
    POST /api/users/admin/create-admin/   (superadmin only)
    Body: { full_name, email, phone, password, display_name?, notes? }
    Always creates an ASSIGNED admin: not staff, not superuser, scope='assigned_admin'.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from apps.users.serializers import CreateAdminSerializer, AdminProfileSerializer
        s = CreateAdminSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response(AdminProfileSerializer(user.admin_profile).data, status=201)
 
 
# ── Admin Profile ─────────────────────────────────────────────────────────
 
class AdminProfileDetailView(APIView):
    """
    GET  /api/users/admin/me/           — get own admin profile + scope
    PATCH /api/users/admin/me/          — update display_name / notes
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from apps.users.serializers import AdminProfileSerializer
        profile = _get_admin_profile(request.user)
        return Response(AdminProfileSerializer(profile).data)
 
    def patch(self, request):
        from apps.users.serializers import AdminProfileSerializer
        profile = _get_admin_profile(request.user)
        s = AdminProfileSerializer(profile, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        # Prevent non-superadmins from changing their own scope
        if 'scope' in s.validated_data and not _is_superadmin(request.user):
            return Response({'error': 'Only superadmins can change scope.'}, status=403)
        s.save()
        return Response(s.data)
 
 
class AdminListView(generics.ListAPIView):
    """
    GET /api/users/admin/admins/
    Superadmin sees all admins with their assignment counts.
    Used to populate the "assign to admin" dropdown.
    """
    permission_classes = [IsSuperAdmin]
 
    def get(self, request):
        from django.contrib.auth import get_user_model
        from apps.users.models import AdminProfile
        from apps.users.serializers import AdminProfileSerializer
        User = get_user_model()
        admins = User.objects.filter(role='admin').select_related('admin_profile')
        result = []
        for admin in admins:
            profile = _get_admin_profile(admin)
            result.append(AdminProfileSerializer(profile).data)
        return Response(result)
 
 
# ── Assignment Management ─────────────────────────────────────────────────
 
class AssignVendorView(APIView):
    """
    POST /api/users/admin/assign-vendor/
    Superadmin assigns a vendor to an admin (or reassigns).
    Body: { vendor_id, admin_id, notes? }
 
    If the vendor already has an active assignment, it is deactivated first.
    """
    permission_classes = [IsSuperAdmin]
 
    def post(self, request):
        from apps.users.models import VendorAdminAssignment
        from apps.users.serializers import AssignVendorSerializer, VendorAdminAssignmentSerializer
        from django.contrib.auth import get_user_model
        User = get_user_model()
 
        s = AssignVendorSerializer(data=request.data)
        s.is_valid(raise_exception=True)
 
        vendor_id = s.validated_data['vendor_id']
        admin_id  = s.validated_data['admin_id']
        notes     = s.validated_data.get('notes', '')
 
        vendor = get_object_or_404(User, pk=vendor_id, role='vendor')
        admin  = get_object_or_404(User, pk=admin_id, role='admin')
 
        # Deactivate any existing active assignment
        existing = VendorAdminAssignment.objects.filter(
            vendor=vendor, is_active=True
        ).first()
        if existing:
            if existing.admin_id == admin_id:
                return Response({
                    'message': f'{vendor.vendor_profile.business_name} is already assigned to {admin.full_name}.',
                    'assignment': VendorAdminAssignmentSerializer(existing).data,
                })
            existing.deactivate(deactivated_by=request.user)
 
        # Create new assignment
        assignment = VendorAdminAssignment.objects.create(
            vendor      = vendor,
            admin       = admin,
            assigned_by = request.user,
            notes       = notes,
        )
 
        return Response({
            'message': f'{vendor.vendor_profile.business_name} assigned to {admin.full_name}.',
            'assignment': VendorAdminAssignmentSerializer(assignment).data,
        }, status=201)
 
 
class UnassignVendorView(APIView):
    """
    POST /api/users/admin/unassign-vendor/
    Superadmin removes a vendor's current admin assignment.
    Body: { vendor_id }
    """
    permission_classes = [IsSuperAdmin]
 
    def post(self, request):
        from apps.users.models import VendorAdminAssignment
        from django.contrib.auth import get_user_model
        User = get_user_model()
        vendor_id = request.data.get('vendor_id')
        if not vendor_id:
            return Response({'error': 'vendor_id is required.'}, status=400)
        vendor = get_object_or_404(User, pk=vendor_id, role='vendor')
        assignment = VendorAdminAssignment.objects.filter(
            vendor=vendor, is_active=True
        ).first()
        if not assignment:
            return Response({'message': 'Vendor has no active assignment.'})
        assignment.deactivate(deactivated_by=request.user)
        return Response({'message': f'{vendor.vendor_profile.business_name} unassigned.'})
 
 
class BulkAssignVendorsView(APIView):
    """
    POST /api/users/admin/bulk-assign/
    Superadmin assigns multiple vendors to one admin at once.
    Body: { vendor_ids: [1, 2, 3], admin_id: 5, notes? }
    """
    permission_classes = [IsSuperAdmin]
 
    def post(self, request):
        from apps.users.models import VendorAdminAssignment
        from django.contrib.auth import get_user_model
        User = get_user_model()
 
        vendor_ids = request.data.get('vendor_ids', [])
        admin_id   = request.data.get('admin_id')
        notes      = request.data.get('notes', '')
 
        if not vendor_ids or not admin_id:
            return Response({'error': 'vendor_ids and admin_id are required.'}, status=400)
 
        admin = get_object_or_404(User, pk=admin_id, role='admin')
        results = {'assigned': [], 'already_assigned': [], 'errors': []}
 
        for vid in vendor_ids:
            try:
                vendor = User.objects.get(pk=vid, role='vendor')
                existing = VendorAdminAssignment.objects.filter(
                    vendor=vendor, is_active=True
                ).first()
                if existing:
                    existing.deactivate(deactivated_by=request.user)
                VendorAdminAssignment.objects.create(
                    vendor=vendor, admin=admin,
                    assigned_by=request.user, notes=notes,
                )
                results['assigned'].append(vid)
            except User.DoesNotExist:
                results['errors'].append(f'Vendor {vid} not found.')
            except Exception as e:
                results['errors'].append(str(e))
 
        return Response({
            'message': f'{len(results["assigned"])} vendor(s) assigned to {admin.full_name}.',
            'results': results,
        })
 
 
class VendorAssignmentHistoryView(generics.ListAPIView):
    """
    GET /api/users/admin/assignment-history/?vendor_id=5
    Full assignment history for a vendor — who managed them and when.
    """
    permission_classes = [IsSuperAdmin]
 
    def get(self, request):
        from apps.users.models import VendorAdminAssignment
        from apps.users.serializers import VendorAdminAssignmentSerializer
        vendor_id = request.query_params.get('vendor_id')
        qs = VendorAdminAssignment.objects.select_related(
            'admin', 'vendor__vendor_profile', 'assigned_by'
        ).order_by('-assigned_at')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        return Response(VendorAdminAssignmentSerializer(qs, many=True).data)
 
 
class AllAssignmentsView(generics.ListAPIView):
    """
    GET /api/users/admin/assignments/
    All active vendor-admin assignments.
    Filterable by admin_id.
    Superadmin only.
    """
    permission_classes = [IsSuperAdmin]
 
    def get(self, request):
        from apps.users.models import VendorAdminAssignment
        from apps.users.serializers import VendorAdminAssignmentSerializer
        qs = VendorAdminAssignment.objects.filter(is_active=True).select_related(
            'admin', 'vendor__vendor_profile', 'assigned_by'
        ).order_by('admin__full_name', 'vendor__vendor_profile__business_name')
        admin_id = request.query_params.get('admin_id')
        if admin_id:
            qs = qs.filter(admin_id=admin_id)
        return Response(VendorAdminAssignmentSerializer(qs, many=True).data)
 
 
class MyAssignedVendorsView(APIView):
    """
    GET /api/users/admin/my-vendors/
    The calling admin sees their own assigned vendors with full profiles.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.users.serializers import VendorProfileFullSerializer  # ← CHANGED
        qs = _get_scoped_vendor_qs(request)
        return Response(VendorProfileFullSerializer(qs, many=True).data)  # ← CHANGED
 
 
# ── Scoped overrides of existing views ───────────────────────────────────
#
# Replace the existing views below in views.py with these scoped versions.
# The only difference is get_queryset() now calls _get_scoped_*() helpers.
 
class ScopedAdminVendorListView(generics.ListAPIView):
    """
    GET /api/users/admin/vendors/
    Superadmin: all vendors.
    Assigned admin: only their assigned vendors.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.users.serializers import VendorProfileFullSerializer  # ← CHANGED
        qs = _get_scoped_vendor_qs(request)
        # Support existing filters
        status_filter = request.query_params.get('status')
        search        = request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(business_name__icontains=search)
        return Response(VendorProfileFullSerializer(qs, many=True).data)  # ← CHANGED
 
 
class ScopedAdminBookingListView(generics.ListAPIView):
    """
    GET /api/bookings/admin/
    Scoped to the admin's assigned vendors.
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from apps.bookings.serializers import BookingDetailSerializer
        qs = _get_scoped_booking_qs(request)
        return Response(BookingDetailSerializer(qs, many=True).data)
 
 
class ScopedAdminUserListView(generics.ListAPIView):
    """
    GET /api/users/admin/users/
    Superadmin: all users.
    Assigned admin: only customers who've booked from their assigned vendors.
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from apps.users.serializers import UserMeSerializer
        role   = request.query_params.get('role', 'customer')
        search = request.query_params.get('search')
 
        if role == 'customer':
            qs = _get_scoped_customer_qs(request)
        else:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            qs = User.objects.filter(role=role)
            if not _is_superadmin(request.user):
                # Non-superadmins only see customer scope
                qs = qs.none()
 
        if search:
            qs = qs.filter(full_name__icontains=search)
        return Response(UserMeSerializer(qs, many=True).data)
 
 
class ScopedAdminDashboardStatsView(APIView):
    """
    GET /api/users/admin/stats/
    Returns stats scoped to the admin's visibility.
    Superadmin sees platform-wide numbers; assigned admin sees their slice.
    """
    permission_classes = [IsAdminRole]
 
    def get(self, request):
        from apps.users.models import VendorProfile
        from apps.users.models import VendorAdminAssignment
        from django.contrib.auth import get_user_model
        User = get_user_model()
 
        is_super = _is_superadmin(request.user)
 
        if is_super:
            return Response({
                'scope': 'superadmin',
                'total_customers':  User.objects.filter(role='customer').count(),
                'total_vendors':    User.objects.filter(role='vendor').count(),
                'pending_vendors':  VendorProfile.objects.filter(status='pending').count(),
                'approved_vendors': VendorProfile.objects.filter(status='approved').count(),
                'rejected_vendors': VendorProfile.objects.filter(status='rejected').count(),
                'total_admins':     User.objects.filter(role='admin').count(),
                'unassigned_vendors': User.objects.filter(
                    role='vendor'
                ).exclude(
                    id__in=VendorAdminAssignment.objects.filter(
                        is_active=True
                    ).values_list('vendor_id', flat=True)
                ).count(),
            })
 
        # Assigned admin — scoped stats
        profile    = _get_admin_profile(request.user)
        vendor_ids = list(profile.assigned_vendor_ids)
 
        from apps.bookings.models import Booking
        customer_ids = Booking.objects.filter(
            vendor_id__in=vendor_ids
        ).values_list('customer_id', flat=True).distinct()
 
        return Response({
            'scope': 'assigned_admin',
            'assigned_vendors':      len(vendor_ids),
            'pending_vendors':       VendorProfile.objects.filter(
                user_id__in=vendor_ids, status='pending').count(),
            'approved_vendors':      VendorProfile.objects.filter(
                user_id__in=vendor_ids, status='approved').count(),
            'total_customers':       customer_ids.count(),
            'total_bookings':        Booking.objects.filter(
                vendor_id__in=vendor_ids).count(),
            'active_bookings':       Booking.objects.filter(
                vendor_id__in=vendor_ids, status='ACTIVE').count(),
        })
 