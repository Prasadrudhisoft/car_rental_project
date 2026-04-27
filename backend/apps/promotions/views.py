from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
 
from .models import PromoCode, PromoUsed
from .serializers import PromoCodeSerializer
 
 
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'admin'
 
 
class ValidatePromoView(APIView):
    """
    POST /api/promos/validate/
    Called at checkout when customer enters a promo code.
    Body: { "code": "FIRST50", "booking_total": "1800.00" }
    Returns: { "valid": true, "discount_inr": "50.00", "message": "..." }
    """
    permission_classes = [permissions.IsAuthenticated]
 
    def post(self, request):
        code_str       = request.data.get("code", "").upper().strip()
        booking_total  = Decimal(str(request.data.get("booking_total", "0")))
 
        try:
            promo = PromoCode.objects.get(code=code_str, is_active=True)
        except PromoCode.DoesNotExist:
            return Response({'valid': False, 'error': 'Invalid promo code.'}, status=400)
 
        now = timezone.now()
        if not (promo.valid_from <= now <= promo.valid_until):
            return Response({'valid': False, 'error': 'Promo code has expired.'}, status=400)
 
        if booking_total < promo.min_booking_value:
            return Response({
                'valid': False,
                'error': f'Minimum booking value for this code is INR {promo.min_booking_value}.',
            }, status=400)
 
        # Single-use check
        if promo.is_single_use:
            if PromoUsed.objects.filter(promo=promo, user=request.user).exists():
                return Response({'valid': False, 'error': 'You have already used this code.'}, status=400)
 
        # Max redemptions check
        if promo.max_redemptions is not None:
            if PromoUsed.objects.filter(promo=promo).count() >= promo.max_redemptions:
                return Response({'valid': False, 'error': 'This promo code is no longer available.'}, status=400)
 
        # Calculate discount
        if promo.discount_type == 'flat':
            discount = min(promo.discount_value, booking_total)
        else:
            discount = booking_total * (promo.discount_value / 100)
            if promo.max_discount_cap:
                discount = min(discount, promo.max_discount_cap)
 
        return Response({
            'valid':        True,
            'code':         promo.code,
            'discount_inr': str(discount.quantize(Decimal('0.01'))),
            'message':      f'{promo.description or promo.code} applied!',
        })
 
 
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
