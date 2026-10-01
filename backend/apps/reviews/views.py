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

from django.db import IntegrityError
from django.db.models import Sum, Count, Q
from car_rent.async_utils import enqueue
from apps.personalization.tasks import run_event_rules_task
 
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
 
        try:
            review = Review.objects.create(
                booking=booking, customer=request.user, vendor=booking.vendor,
                vehicle=booking.vehicle, vendor_rating=vendor_rating,
                vehicle_rating=vehicle_rating, review_text=review_text,
            )
        except IntegrityError:          # two simultaneous submits (OneToOne on booking)
            return Response({'error': 'You have already reviewed this booking.'}, status=400)

        _recalculate_vendor_rating(booking.vendor)
        enqueue(run_event_rules_task, request.user.id, 'review_submitted')

        return Response({'message': 'Review submitted. Thank you!', 'review_id': review.id}, status=201)
 
        return Response({'message': 'Review submitted. Thank you!', 'review_id': review.id},
                        status=201)
 
 
def _recalculate_vendor_rating(vendor):
    from django.utils import timezone
    from datetime import timedelta
    from apps.users.models import VendorProfile

    cutoff = timezone.now() - timedelta(days=90)
    agg = Review.objects.filter(vendor=vendor, is_visible=True).aggregate(
        recent_sum=Sum('vendor_rating', filter=Q(created_at__gte=cutoff)),
        recent_n=Count('id',            filter=Q(created_at__gte=cutoff)),
        old_sum=Sum('vendor_rating',    filter=Q(created_at__lt=cutoff)),
        old_n=Count('id',               filter=Q(created_at__lt=cutoff)),
    )
    recent_sum, recent_n = agg['recent_sum'] or 0, agg['recent_n'] or 0
    old_sum,    old_n    = agg['old_sum'] or 0,    agg['old_n'] or 0

    weight = 2 * recent_n + old_n
    weighted = (Decimal(2 * recent_sum + old_sum) / Decimal(weight)).quantize(Decimal("0.01")) \
               if weight else Decimal("0")
    total = recent_n + old_n

    suspend_threshold = get_config('vendor_suspend_rating', Decimal('3.5'))
    is_flagged = weighted < suspend_threshold and total >= 3

    snapshot, _ = VendorRatingSnapshot.objects.update_or_create(
        vendor=vendor,
        defaults={'weighted_score': weighted, 'total_reviews': total, 'is_flagged': is_flagged},
    )
    VendorProfile.objects.filter(user=vendor).update(rating=weighted, total_reviews=total)
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
