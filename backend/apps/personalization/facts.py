"""
Builds a plain dict of behavioral facts for one customer. This is the
single place that knows how to read Bookings/Reviews/CustomerProfile —
segments and rules never touch the ORM directly, they only see this dict.
Extending targeting to a new signal means adding one key here.
"""
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Avg


def build_customer_facts(user) -> dict:
    from apps.bookings.models import Booking
    from apps.reviews.models import Review

    now = timezone.now()
    profile = getattr(user, 'customer_profile', None)

    bookings = Booking.objects.filter(customer=user)
    completed = bookings.filter(status='COMPLETED')
    cancelled = bookings.filter(status='CANCELLED')
    active_or_pending = bookings.filter(status__in=['PENDING', 'CONFIRMED', 'ACTIVE'])

    last_booking = bookings.order_by('-created_at').first()
    last_completed = completed.order_by('-return_date').first()

    spend_agg = completed.exclude(status='CANCELLED').aggregate(
        total=Sum('total_amount'), avg=Avg('total_amount'))

    segment_counts = (completed.values('vehicle__segment')
                       .annotate(n=Count('id')).order_by('-n'))
    favorite_segment = segment_counts[0]['vehicle__segment'] if segment_counts else None

    reviews_written = Review.objects.filter(customer=user).count()

    days_since_signup = (now.date() - user.date_joined.date()).days if user.date_joined else None
    days_since_last_booking = (
        (now.date() - last_booking.created_at.date()).days if last_booking else None
    )
    days_since_last_completed = (
        (now.date() - last_completed.return_date).days if last_completed else None
    )

    loyalty_points = profile.loyalty_points if profile else 0
    loyalty_tier = (
        'gold' if loyalty_points >= 1000 else
        'silver' if loyalty_points >= 500 else
        'bronze'
    )

    return {
        'user_id': user.id,
        'email': user.email,
        'first_name': (user.full_name or '').split(' ')[0] or 'there',
        'days_since_signup': days_since_signup,
        'total_bookings': bookings.count(),
        'completed_bookings': completed.count(),
        'cancelled_bookings': cancelled.count(),
        'has_active_or_pending_booking': active_or_pending.exists(),
        'has_pending_payment': bookings.filter(status='PENDING').exists(),
        'days_since_last_booking': days_since_last_booking,
        'days_since_last_completed_booking': days_since_last_completed,
        'total_spend': float(spend_agg['total'] or 0),
        'avg_booking_value': float(spend_agg['avg'] or 0),
        'favorite_segment': favorite_segment,
        'loyalty_points': loyalty_points,
        'loyalty_tier': loyalty_tier,
        'kyc_complete': bool(profile and profile.kyc_status == 'verified'),
        'kyc_status': profile.kyc_status if profile else 'pending',
        'reviews_written': reviews_written,
        'is_first_time_customer': completed.count() == 0 and bookings.count() <= 1,
        'is_repeat_customer': completed.count() >= 2,
    }