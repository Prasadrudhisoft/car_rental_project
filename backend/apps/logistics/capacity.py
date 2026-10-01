from django.db.models import Count

from .models import HandoverRecord, VendorNetwork

# A slot is occupied from the moment payment reserves it until the car is retrieved.
ACTIVE_HANDOVER_STATUSES = ['EXPECTED', 'RECEIVED', 'INSPECTED', 'HELD', 'SUBLISTED']


class ReturnCapacityConflict(Exception):
    """Chosen drop point is full / no longer accepting other vendors' cars."""


def occupied_counts(vendor_ids):
    return dict(
        HandoverRecord.objects.filter(
            receiving_vendor_id__in=list(vendor_ids), status__in=ACTIVE_HANDOVER_STATUSES,
        ).order_by().values_list('receiving_vendor_id').annotate(n=Count('id'))
    )


def occupied_count(vendor_id):
    return occupied_counts([vendor_id]).get(vendor_id, 0)


def available_slots(member):
    return max(0, member.max_vehicles - occupied_count(member.vendor_id))


def network_member_for_location(location_id, lock=False):
    """The ACTIVE network member whose own location (profile pin) is `location_id`."""
    qs = VendorNetwork.objects.filter(
        is_active=True, vendor__is_active=True,
        vendor__vendor_profile__pickup_location_id=location_id,
    )
    if lock:
        qs = qs.select_for_update()      # call only inside transaction.atomic()
    return qs.first()


def available_return_options(city_id, exclude_vendor_id=None):
    """Drop points a customer may choose in `city_id`: opted-in vendors with a free slot."""
    prefix = 'vendor__vendor_profile__'
    members = VendorNetwork.objects.filter(**{
        'is_active': True, 'vendor__is_active': True,
        prefix + 'city_id': city_id,
        prefix + 'pickup_location__isnull': False,
        prefix + 'pickup_location__is_active': True,
        prefix + 'pickup_location__latitude__isnull': False,
        prefix + 'pickup_location__longitude__isnull': False,
    }).select_related('vendor__vendor_profile__pickup_location')
    if exclude_vendor_id:
        members = members.exclude(vendor_id=exclude_vendor_id)
    members = list(members)

    held = occupied_counts([m.vendor_id for m in members])
    out = []
    for m in members:
        slots = m.max_vehicles - held.get(m.vendor_id, 0)
        if slots <= 0:
            continue                                 # full -> not offered
        p, loc = m.vendor.vendor_profile, m.vendor.vendor_profile.pickup_location
        out.append({
            'location_id':     loc.id,
            'vendor_id':       m.vendor_id,
            'name':            p.business_name,
            'address':         loc.address or '',
            'latitude':        str(loc.latitude),
            'longitude':       str(loc.longitude),
            'available_slots': slots,
            'rating':          str(p.rating),
            'opening_time':    str(p.shop_opening_time or ''),
            'closing_time':    str(p.shop_closing_time or ''),
        })
    return out


def validate_return_location(location, origin_vendor_id):
    """Non-locking early check used when the booking is created. Returns an error string or None."""
    member = network_member_for_location(location.id)
    if member is None:
        if location.location_type == 'vendor_lot':
            return 'This drop point is no longer accepting vehicles from other vendors.'
        return None                                  # admin-defined location, fallback lot logic applies
    if member.vendor_id == origin_vendor_id:
        return 'Please choose a drop point run by a different vendor.'
    if available_slots(member) <= 0:
        return 'This drop point is full right now. Please choose another one.'
    return None


def release_return_slot(booking):
    """Free the reserved slot when a booking is cancelled before the car is dropped."""
    from .models import RevenueShare
    HandoverRecord.objects.filter(booking=booking, status='EXPECTED').delete()
    RevenueShare.objects.filter(booking=booking).delete()