from decimal import Decimal
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
 
from apps.bookings.models import Booking
from apps.configuration.utils import get_config
 
from .models import Review, VendorRatingSnapshot
from .serializers import ReviewSerializer, ReviewListSerializer
 
 
class IsCustomerRole(permissions.BasePermission):
    def has_permission(self, r, v):
        return r.user.is_authenticated and r.user.role == 'customer'
 
 
class SubmitReviewView(APIView):
    """
    POST /api/reviews/submit/
    Customer submits a review after a COMPLETED booking.
    Body: { booking_id, vendor_rating, vehicle_rating, review_text }
    """
    permission_classes = [IsCustomerRole]
 
    def post(self, request):
        booking_id     = request.data.get("booking_id")
        vendor_rating  = int(request.data.get("vendor_rating", 0))
        vehicle_rating = int(request.data.get("vehicle_rating", 0))
        review_text    = request.data.get("review_text", "")
 
        if not 1 <= vendor_rating <= 5 or not 1 <= vehicle_rating <= 5:
            return Response({'error': 'Ratings must be between 1 and 5.'}, status=400)
 
        booking = get_object_or_404(
            Booking,
            pk       = booking_id,
            customer = request.user,
            status   = 'COMPLETED',
        )
 
        if hasattr(booking, "review"):
            return Response({'error': 'You have already reviewed this booking.'}, status=400)
 
        review = Review.objects.create(
            booking        = booking,
            customer       = request.user,
            vendor         = booking.vendor,
            vehicle        = booking.vehicle,
            vendor_rating  = vendor_rating,
            vehicle_rating = vehicle_rating,
            review_text    = review_text,
        )
 
        # Recalculate vendor rating after every new review
        _recalculate_vendor_rating(booking.vendor)
 
        return Response({'message': 'Review submitted. Thank you!', 'review_id': review.id},
                        status=201)
 
 
def _recalculate_vendor_rating(vendor):
    """
    Weighted rating algorithm.
    Recent reviews (last 3 months) carry 2x weight.
    Older reviews carry 1x weight.
    Minimum rating thresholds read from config.
    """
    from django.utils import timezone
    from datetime import timedelta
 
    cutoff = timezone.now() - timedelta(days=90)
    recent = Review.objects.filter(vendor=vendor, is_visible=True,
                                    created_at__gte=cutoff)
    older  = Review.objects.filter(vendor=vendor, is_visible=True,
                                    created_at__lt=cutoff)
 
    recent_scores = list(recent.values_list("vendor_rating", flat=True))
    older_scores  = list(older.values_list("vendor_rating", flat=True))
 
    # Double-weight recent reviews
    all_scores = recent_scores * 2 + older_scores
 
    if not all_scores:
        weighted = Decimal("0")
    else:
        weighted = Decimal(str(sum(all_scores) / len(all_scores))).quantize(Decimal("0.01"))
 
    total = Review.objects.filter(vendor=vendor, is_visible=True).count()
 
    suspend_threshold = get_config('vendor_suspend_rating', Decimal('3.5'))
    is_flagged = weighted < suspend_threshold and total >= 3
 
    snapshot, _ = VendorRatingSnapshot.objects.update_or_create(
        vendor=vendor,
        defaults={
            'weighted_score': weighted,
            'total_reviews':  total,
            'is_flagged':     is_flagged,
        }
    )
 
    # Also update vendor profile rating for display
    try:
        vendor.vendor_profile.rating       = weighted
        vendor.vendor_profile.total_reviews = total
        vendor.vendor_profile.save(update_fields=["rating", "total_reviews"])
    except Exception:
        pass
 
    return snapshot
 
 
class VendorReviewListView(generics.ListAPIView):
    """
    GET /api/reviews/vendor/{vendor_id}/?ordering=recency|rating
    Public — anyone can see reviews for a vendor.
    """
    serializer_class   = ReviewListSerializer
    permission_classes = [permissions.AllowAny]
 
    def get_queryset(self):
        vendor_id = self.kwargs["vendor_id"]
        qs = Review.objects.filter(
            vendor_id=vendor_id, is_visible=True
        ).select_related("customer", "vehicle")
        ordering = self.request.query_params.get('ordering', 'recency')
        if ordering == 'rating':
            qs = qs.order_by("-vendor_rating", "-created_at")
        else:
            qs = qs.order_by("-created_at")
        return qs
 
 
class VehicleReviewListView(generics.ListAPIView):
    """GET /api/reviews/vehicle/{vehicle_id}/ — reviews for a specific vehicle."""
    serializer_class   = ReviewListSerializer
    permission_classes = [permissions.AllowAny]
 
    def get_queryset(self):
        return Review.objects.filter(
            vehicle_id=self.kwargs["vehicle_id"], is_visible=True
        ).select_related("customer").order_by("-created_at")
 
 
class PendingReviewView(APIView):
    """
    GET /api/reviews/pending/
    Returns completed bookings that the customer has not yet reviewed.
    Used to prompt the post-rental review on the customer dashboard.
    """
    permission_classes = [IsCustomerRole]
 
    def get(self, request):
        completed = Booking.objects.filter(
            customer = request.user,
            status   = 'COMPLETED',
        ).exclude(review__isnull=False)
        data = [
            {
                'booking_id':      b.id,
                'booking_ref':     b.booking_ref,
                'vehicle_display': f'{b.vehicle.year} {b.vehicle.make} {b.vehicle.model}',
                'return_date':     str(b.return_date),
            }
            for b in completed
        ]
        return Response({'pending_reviews': data})
