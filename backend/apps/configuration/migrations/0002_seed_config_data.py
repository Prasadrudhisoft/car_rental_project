from decimal import Decimal
from django.db import migrations


CATEGORIES = [
    {'name': 'Pricing',       'slug': 'pricing',       'description': 'GST, commission, and minimum-rate rules.'},
    {'name': 'Cancellation',  'slug': 'cancellation',   'description': 'Refund windows for customer cancellations.'},
    {'name': 'Loyalty',       'slug': 'loyalty',        'description': 'Points earning and redemption rates.'},
    {'name': 'Logistics',     'slug': 'logistics',      'description': 'Cross-city handling and sub-listing fees.'},
    {'name': 'Certification', 'slug': 'certification',  'description': 'Vehicle mechanic-certification validity windows.'},
    {'name': 'Reviews',       'slug': 'reviews',        'description': 'Vendor rating thresholds.'},
]

SETTINGS = [
    # key, display_name, value, value_type, description, category_slug, is_editable
    ('gst_rate', 'GST Rate', '18', 'percentage',
     'GST charged on every booking. Stored as 18, applied as 0.18.', 'pricing', True),
    ('min_daily_rate', 'Minimum Daily Rate', '300', 'number',
     'Vendors cannot list a vehicle below this daily rate (INR).', 'pricing', True),
    ('platform_commission', 'Platform Commission', '18', 'percentage',
     'Platform''s cut of every booking. Stored as 18, applied as 0.18.', 'pricing', True),

    ('cancellation_free_hours', 'Free Cancellation Window (hours)', '48', 'number',
     'Full refund if cancelled at least this many hours before pickup.', 'cancellation', True),
    ('cancellation_half_refund_hours', 'Half-Refund Window (hours)', '24', 'number',
     '50% refund if cancelled between this and the free-cancellation window.', 'cancellation', True),

    ('loyalty_points_per_inr', 'Points Earned per INR', '10', 'percentage',
     'Loyalty points credited per rupee spent. Stored as 10, applied as 0.10.', 'loyalty', True),
    ('loyalty_points_inr_value', 'Point Redemption Value (INR)', '0.25', 'number',
     'INR discount value of a single redeemed loyalty point.', 'loyalty', True),

    ('cross_city_handling_fee_min', 'Cross-City Handling Fee (INR)', '300', 'number',
     'Base fee paid to the partner vendor receiving a one-way return.', 'logistics', True),
    ('cross_city_partner_sublisting_pct', 'Partner Sub-listing Share', '5', 'percentage',
     'Extra share paid to a partner vendor if they sub-list the returned vehicle.', 'logistics', True),

    ('certification_validity_months', 'Certification Validity (months)', '6', 'number',
     'How long a mechanic certification stays valid after issue.', 'certification', True),
    ('certification_validity_km', 'Certification Validity (km)', '10000', 'number',
     'Additional odometer distance covered before re-certification is needed.', 'certification', True),

    ('vendor_suspend_rating', 'Auto-Flag Rating Threshold', '3.5', 'number',
     'Vendors whose weighted rating drops below this (with 3+ reviews) are flagged.', 'reviews', True),
]

SEGMENTS = [
    # segment_name, display_name, security_deposit, min_driver_age, min_rental_days
    ('hatchback', 'Hatchback', Decimal('3000.00'), 21, 1),
    ('sedan',     'Sedan',     Decimal('5000.00'), 21, 1),
    ('suv',       'SUV',       Decimal('7000.00'), 23, 1),
    ('luxury',    'Luxury',    Decimal('20000.00'), 25, 2),
    ('van',       'Van / MPV', Decimal('6000.00'), 23, 1),
    ('truck',     'Truck / Pickup', Decimal('8000.00'), 25, 1),
]


def seed_data(apps, schema_editor):
    ConfigCategory = apps.get_model('configuration', 'ConfigCategory')
    ConfigSetting  = apps.get_model('configuration', 'ConfigSetting')
    VehicleSegmentConfig = apps.get_model('configuration', 'VehicleSegmentConfig')

    cat_by_slug = {}
    for c in CATEGORIES:
        obj, _ = ConfigCategory.objects.get_or_create(
            slug=c['slug'],
            defaults={'name': c['name'], 'description': c['description'], 'is_active': True},
        )
        cat_by_slug[c['slug']] = obj

    for key, display_name, value, value_type, description, cat_slug, is_editable in SETTINGS:
        ConfigSetting.objects.get_or_create(
            key=key,
            defaults={
                'display_name': display_name,
                'value': value,
                'value_type': value_type,
                'description': description,
                'category': cat_by_slug[cat_slug],
                'is_active': True,
                'is_editable': is_editable,
            },
        )

    for segment_name, display_name, deposit, min_age, min_days in SEGMENTS:
        VehicleSegmentConfig.objects.get_or_create(
            segment_name=segment_name,
            defaults={
                'display_name': display_name,
                'security_deposit': deposit,
                'min_driver_age': min_age,
                'min_rental_days': min_days,
                'is_active': True,
            },
        )


def unseed_data(apps, schema_editor):
    ConfigCategory = apps.get_model('configuration', 'ConfigCategory')
    ConfigSetting  = apps.get_model('configuration', 'ConfigSetting')
    VehicleSegmentConfig = apps.get_model('configuration', 'VehicleSegmentConfig')
    ConfigSetting.objects.filter(key__in=[s[0] for s in SETTINGS]).delete()
    VehicleSegmentConfig.objects.filter(segment_name__in=[s[0] for s in SEGMENTS]).delete()
    ConfigCategory.objects.filter(slug__in=[c['slug'] for c in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuration', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(seed_data, unseed_data),
    ]