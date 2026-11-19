import datetime

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.locations.models import Location
from apps.vehicles.models import Vehicle

from .lifecycle import (LifecycleError, mark_no_show, modify_booking,
                        quote_modification, vehicle_options)
from .models import Booking
from .lifecycle import current_points, vehicle_options

def _d(s):
    return datetime.datetime.strptime(s, '%Y-%m-%d').date() if s else None


def _params(d):
    out = {}
    for k in ('pickup_date', 'return_date'):
        if d.get(k):
            out[k] = _d(d[k])
    for k in ('pickup_time', 'return_time'):
        if d.get(k):
            out[k] = d[k]
    if d.get('vehicle_id'):
        v = Vehicle.objects.select_related('vendor__vendor_profile', 'pickup_location').filter(pk=d['vehicle_id']).first()
        if not v:
            raise LifecycleError('Vehicle not found.')
        out['vehicle'] = v
    if 'return_location_id' in d:                      # key present + null  => round trip
        rid = d.get('return_location_id')
        loc = Location.objects.filter(pk=rid).first() if rid else None
        if rid and not loc:
            raise LifecycleError('Return location not found.')
        out['return_location'] = loc
    return out


def _plan_json(p):
    return {
        'available': True, 'has_changes': bool(p['kinds']), 'change_types': p['kinds'],
        'old_total': str(p['old_total']), 'new_total': str(p['new_total']), 'delta': str(p['delta']),
        'modification_fee': str(p['fee']), 'amount_due_now': str(p['due']), 'refund_due': str(p['refund']),
        'free_window': p['free'], 'is_upgrade': 'upgrade' in p['kinds'],
        'security_deposit': p['quote']['security_deposit'], 'one_way_fee': p['quote']['one_way_fee'],
        'promo_code': p['quote'].get('promo_code'), 'old': p['old'], 'new': p['new'],
    }


class _Base(APIView):
    permission_classes = [IsAuthenticated]
    owner = 'customer'                                  # field on Booking that must equal request.user

    def booking(self, request, pk):
        return get_object_or_404(Booking, **{'pk': pk, self.owner: request.user})


class ModificationQuoteView(_Base):
    """POST /bookings/<id>/modify/quote/ — preview only, writes nothing."""
    def post(self, request, pk):
        b = self.booking(request, pk)
        try:
            return Response(_plan_json(quote_modification(b, request.user, **_params(request.data))))
        except (LifecycleError, ValueError) as e:
            return Response({'available': False, 'reason': str(e) or 'Invalid request.'})


class ModificationApplyView(_Base):
    """POST /bookings/<id>/modify/"""
    def post(self, request, pk):
        self.booking(request, pk)
        try:
            r = modify_booking(pk, actor=request.user, request=request,
                               reason=request.data.get('reason', ''), **_params(request.data))
        except (LifecycleError, ValueError) as e:
            return Response({'detail': str(e) or 'Invalid request.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': r['status'], 'amount_due': str(r.get('amount_due', 0)),
                         'refund_due': str(r.get('refund_due', 0)), 'modification_id': r['modification'].pk})


class ModificationOptionsView(_Base):
    def get(self, request, pk):
        b = self.booking(request, pk)
        try:
            data = vehicle_options(b, request.user, _d(request.query_params.get('pickup_date')),
                                   _d(request.query_params.get('return_date')))
        except (LifecycleError, ValueError) as e:
            return Response({'detail': str(e)}, status=400)
        for d in data:
            if d['cover_photo']:
                d['cover_photo'] = request.build_absolute_uri(d['cover_photo'])
        return Response({'vehicles': data, 'current': current_points(b)})

class VendorModificationQuoteView(ModificationQuoteView):
    owner = 'vendor'


class VendorModificationApplyView(ModificationApplyView):      # also serves the legacy /reschedule/ URL
    owner = 'vendor'


class VendorModificationOptionsView(ModificationOptionsView):
    owner = 'vendor'


class VendorMarkNoShowView(_Base):
    """POST /bookings/vendor/<id>/no-show/ — allowed once the pickup date has ended."""
    owner = 'vendor'

    def post(self, request, pk):
        b = self.booking(request, pk)
        try:
            mark_no_show(b.pk, actor=request.user, request=request)
        except LifecycleError as e:
            return Response({'detail': str(e)}, status=400)
        return Response({'status': 'NO_SHOW'})