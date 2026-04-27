from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.vehicles.models import Vehicle

from .models import City, Location, CityPairFee
from .serializers import CitySerializer, LocationSerializer, CityPairFeeSerializer


# ── Permission helpers ────────────────────────────────────────────────
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


class AdminWriteOrReadOnly(permissions.BasePermission):
    """
    Anyone can GET (read).
    Only admins can POST / PATCH / PUT / DELETE (write).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


# ════════════════════════════════════════════════════════════════════
# CITIES
# ════════════════════════════════════════════════════════════════════

class CityViewSet(viewsets.ModelViewSet):
    """
    GET    /api/locations/cities/          → list all active cities  (public)
    POST   /api/locations/cities/          → create city             (admin only)
    PATCH  /api/locations/cities/{id}/     → update city             (admin only)
    DELETE /api/locations/cities/{id}/     → delete city             (admin only)
    GET    /api/locations/cities/{id}/locations/  → all pickup points in a city (public)
    """
    serializer_class   = CitySerializer
    permission_classes = [AdminWriteOrReadOnly]

    def get_queryset(self):
        # Admin sees all cities (including inactive); public sees only active
        if self.request.user.is_authenticated and getattr(self.request.user, 'role', None) == 'admin':
            return City.objects.all().order_by('name')
        return City.objects.filter(is_active=True).order_by('name')

    @action(detail=True, methods=['get'])
    def locations(self, request, pk=None):
        """GET /api/locations/cities/{id}/locations/ — all active pickup points in a city"""
        city = self.get_object()
        locs = Location.objects.filter(city=city, is_active=True).order_by('name')
        return Response(LocationSerializer(locs, many=True).data)


# ════════════════════════════════════════════════════════════════════
# LOCATIONS
# ════════════════════════════════════════════════════════════════════

class LocationViewSet(viewsets.ModelViewSet):
    """
    GET    /api/locations/locations/           → list (public, filterable by city/type)
    POST   /api/locations/locations/           → create (admin only)
    PATCH  /api/locations/locations/{id}/      → update (admin only)
    DELETE /api/locations/locations/{id}/      → delete (admin only)
    """
    serializer_class   = LocationSerializer
    permission_classes = [AdminWriteOrReadOnly]

    def get_queryset(self):
        qs    = Location.objects.select_related('city')
        # Admin can see inactive locations too
        if not (self.request.user.is_authenticated and
                getattr(self.request.user, 'role', None) == 'admin'):
            qs = qs.filter(is_active=True)
        city  = self.request.query_params.get('city')
        ltype = self.request.query_params.get('type')
        if city:  qs = qs.filter(city_id=city)
        if ltype: qs = qs.filter(location_type=ltype)
        return qs.order_by('city__name', 'name')


# ════════════════════════════════════════════════════════════════════
# CITY PAIR FEES
# ════════════════════════════════════════════════════════════════════

class CityPairFeeViewSet(viewsets.ModelViewSet):
    """
    GET    /api/locations/fees/        → list (public, filterable)
    POST   /api/locations/fees/        → create (admin only)
    PATCH  /api/locations/fees/{id}/   → update (admin only)
    DELETE /api/locations/fees/{id}/   → delete (admin only)
    """
    serializer_class   = CityPairFeeSerializer
    permission_classes = [AdminWriteOrReadOnly]

    def get_queryset(self):
        qs = CityPairFee.objects.select_related('from_city', 'to_city')
        if not (self.request.user.is_authenticated and
                getattr(self.request.user, 'role', None) == 'admin'):
            qs = qs.filter(is_active=True)
        f = self.request.query_params.get('from_city')
        t = self.request.query_params.get('to_city')
        if f: qs = qs.filter(from_city_id=f)
        if t: qs = qs.filter(to_city_id=t)
        return qs


# ════════════════════════════════════════════════════════════════════
# VENDOR LOCATIONS MAP VIEW
# ════════════════════════════════════════════════════════════════════

class VendorLocationsView(APIView):
    """
    GET /api/locations/vendor-locations/?city=<city_id>
    Returns all active vendor pickup-location coordinates in a city.
    Used to render clickable markers on the booking map.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        city_id = request.query_params.get('city')
        if not city_id:
            return Response({'error': 'city parameter is required.'}, status=400)

        vehicles = Vehicle.objects.filter(
            city_id=city_id,
            status='LIVE',
            is_blacklisted=False,
            pickup_location__isnull=False,
            pickup_location__latitude__isnull=False,
            pickup_location__longitude__isnull=False,
        ).select_related('vendor__vendor_profile', 'pickup_location')

        seen    = set()
        results = []
        for v in vehicles:
            loc = v.pickup_location
            if loc.id in seen:
                continue
            seen.add(loc.id)
            try:
                vendor_name = v.vendor.vendor_profile.business_name
            except Exception:
                vendor_name = v.vendor.full_name

            results.append({
                'location_id': loc.id,
                'name':        loc.name,
                'address':     loc.address or '',
                'latitude':    str(loc.latitude),
                'longitude':   str(loc.longitude),
                'vendor_name': vendor_name,
                'vendor_id':   v.vendor.id,
            })

        return Response(results)