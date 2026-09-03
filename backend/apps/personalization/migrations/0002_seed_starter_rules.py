from django.db import migrations


def seed(apps, schema_editor):
    Segment = apps.get_model('personalization', 'Segment')
    TargetingRule = apps.get_model('personalization', 'TargetingRule')

    seg_new = Segment.objects.create(
        name='New Customer — No Bookings Yet',
        description='Signed up but never completed a booking.',
        conditions=[{'field': 'total_bookings', 'op': 'eq', 'value': 0}],
    )
    seg_at_risk = Segment.objects.create(
        name='At-Risk — Inactive 60+ Days',
        description='Completed at least one rental but nothing in 60+ days.',
        conditions=[
            {'field': 'completed_bookings', 'op': 'gte', 'value': 1},
            {'field': 'days_since_last_completed_booking', 'op': 'gte', 'value': 60},
        ],
    )
    seg_vip = Segment.objects.create(
        name='VIP — Gold Loyalty Tier',
        description='1000+ loyalty points.',
        conditions=[{'field': 'loyalty_tier', 'op': 'eq', 'value': 'gold'}],
    )
    seg_abandoned = Segment.objects.create(
        name='Abandoned Payment',
        description='Created a booking but never completed payment.',
        conditions=[{'field': 'has_pending_payment', 'op': 'is_true', 'value': None}],
    )
    seg_no_review = Segment.objects.create(
        name='Completed Trip, No Review',
        description='Finished a rental but has never written a review.',
        conditions=[
            {'field': 'completed_bookings', 'op': 'gte', 'value': 1},
            {'field': 'reviews_written', 'op': 'eq', 'value': 0},
        ],
    )

    TargetingRule.objects.create(
        name='Welcome — First Booking Nudge', segment=seg_new,
        trigger_type='event', event_name='signup',
        action_type='notification',
        action_config={
            'title': 'Welcome to RudhiDrive, {{first_name}}!',
            'message': 'Book your first ride and get moving — verified vehicles, transparent pricing.',
            'link_url': '/book/select-car',
        },
        cooldown_days=9999, priority=10,
    )
    TargetingRule.objects.create(
        name='Win-Back — 60 Day Inactive', segment=seg_at_risk,
        trigger_type='scheduled', action_type='promo_code',
        action_config={
            'code_prefix': 'COMEBACK', 'discount_type': 'percentage', 'discount_value': 15,
            'max_discount_cap': 500, 'valid_days': 10,
            'notify_title': 'We miss you! Here’s 15% off',
            'notify_message': 'It’s been a while — use {{code}} for 15% off your next ride.',
        },
        cooldown_days=45, priority=20,
    )
    TargetingRule.objects.create(
        name='VIP Loyalty Bonus', segment=seg_vip,
        trigger_type='scheduled', action_type='loyalty_bonus',
        action_config={'points': 100},
        cooldown_days=90, priority=30,
    )
    TargetingRule.objects.create(
        name='Payment Reminder', segment=seg_abandoned,
        trigger_type='scheduled', action_type='notification',
        action_config={
            'title': 'Complete your booking payment',
            'message': 'Your booking is waiting — finish payment to confirm your ride.',
            'link_url': '/customer?tab=bookings',
        },
        cooldown_days=2, priority=5, stop_on_match=True,
    )
    TargetingRule.objects.create(
        name='Review Reminder', segment=seg_no_review,
        trigger_type='event', event_name='booking_completed',
        action_type='notification',
        action_config={
            'title': 'How was your trip?',
            'message': 'Share a quick review — it helps other renters and earns you loyalty points.',
            'link_url': '/customer?tab=reviews',
        },
        cooldown_days=7, priority=40,
    )


class Migration(migrations.Migration):
    dependencies = [('personalization', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]