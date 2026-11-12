from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from apps.vehicles.models import Vehicle

from .lifecycle import (LifecycleError, apply_modification, mark_no_show,
                        quote_modification, vendor_reschedule)
from .models import Booking


def _dt(s):
    from datetime import datetime
    return datetime.strptime(s, '%Y-%m-%d').date() if s else None


def _params(d):
    veh = Vehicle.objects.filter(pk=d['vehicle_id']).first() if d.get('vehicle_id') else None
    return dict(pickup_date=_dt(d.get('pickup_date')), return_date=_dt(d.get('return_date')),
                pickup_time=d.get('pickup_time') or None, return_time=d.get('return_time') or None,
                vehicle=veh)


class ModificationQuoteView(APIView):
    """POST /api/bookings/<id>/modify/quote/  — preview only, writes nothing."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        b = get_object_or_404(Booking, pk=pk, customer=request.user)
        q = quote_modification(b, **_params(request.data))
        q.pop('quote', None)
        return Response({k: (str(v) if hasattr(v, 'quantize') else v) for k, v in q.items()})


class ModificationApplyView(APIView):
    """POST /api/bookings/<id>/modify/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            r = apply_modification(pk, customer_user=request.user, request=request,
                                   **_params(request.data))
        except LifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': r['status'],
                         'amount_due': str(r.get('amount_due', 0)),
                         'refund_due': str(r.get('refund_due', 0))})


class VendorRescheduleView(APIView):
    """POST /api/bookings/vendor/<id>/reschedule/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        d = request.data
        try:
            b = vendor_reschedule(pk, vendor_user=request.user, request=request,
                                  new_pickup_date=_dt(d.get('pickup_date')),
                                  new_return_date=_dt(d.get('return_date')),
                                  new_pickup_time=d.get('pickup_time') or None,
                                  new_return_time=d.get('return_time') or None,
                                  reason=d.get('reason', ''))
        except LifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': b.status, 'pickup_date': b.pickup_date, 'return_date': b.return_date})


class VendorMarkNoShowView(APIView):
    """POST /api/bookings/vendor/<id>/no-show/  (manual, after grace period)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        b = get_object_or_404(Booking, pk=pk, vendor=request.user)
        try:
            mark_no_show(b.pk, actor=request.user, request=request)
        except LifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'NO_SHOW'})
