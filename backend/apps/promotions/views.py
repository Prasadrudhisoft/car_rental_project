from rest_framework import generics, permissions
 
from .models import PromoCode
from .serializers import PromoCodeSerializer
 
 
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'admin'
 
 
 
class AdminPromoViewSet(generics.ListCreateAPIView):
    """
    GET  /api/promos/admin/   — list all promo codes
    POST /api/promos/admin/   — create a new promo code
    """
    serializer_class   = PromoCodeSerializer
    permission_classes = [IsAdminRole]
 
    def get_queryset(self):
        return PromoCode.objects.all().order_by("-created_at")
 
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
 
 
class AdminPromoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH / DELETE /api/promos/admin/{id}/"""
    serializer_class   = PromoCodeSerializer
    permission_classes = [IsAdminRole]
    queryset           = PromoCode.objects.all()
