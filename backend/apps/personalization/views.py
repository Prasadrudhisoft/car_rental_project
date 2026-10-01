from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Segment, TargetingRule, RuleExecutionLog
from .serializers import SegmentSerializer, TargetingRuleSerializer, RuleExecutionLogSerializer
from .facts import build_customer_facts
from .engine import user_matches_segment, run_rule_for_user, run_scheduled_rules
from car_rent.async_utils import enqueue 
from .tasks import run_rule_now_task, evaluate_scheduled_targeting_rules


User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'


class SegmentViewSet(viewsets.ModelViewSet):
    queryset = Segment.objects.all()
    serializer_class = SegmentSerializer
    permission_classes = [IsAdminRole]

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """
        GET /api/personalization/segments/{id}/preview/
        Computes live membership count + a sample so admins can see who a
        segment actually matches before wiring a rule to it.
        """
        segment   = self.get_object()
        customers = User.objects.filter(role='customer', is_active=True)
        matched, total = [], 0
        for u in customers.iterator(chunk_size=500):
            if user_matches_segment(segment, build_customer_facts(u)):
                total += 1
                if len(matched) < 25:
                    matched.append({'id': u.id, 'full_name': u.full_name, 'email': u.email})
        return Response({'total_matching': total, 'sample': matched})


class TargetingRuleViewSet(viewsets.ModelViewSet):
    queryset = TargetingRule.objects.select_related('segment').all()
    serializer_class = TargetingRuleSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='run-now')
    def run_now(self, request, pk=None):
        """
        POST /api/personalization/rules/{id}/run-now/
        Manually evaluate one rule against all matching users right now —
        used for testing a rule before trusting it to the nightly batch.
        """
        rule = self.get_object()
        enqueue(run_rule_now_task, rule.id)
        return Response({'message': 'Rule queued — it is being evaluated in the background.'}, status=202)


class RuleExecutionLogListView(viewsets.ReadOnlyModelViewSet):
    queryset = RuleExecutionLog.objects.select_related('rule', 'user').all()
    serializer_class = RuleExecutionLogSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = super().get_queryset()
        rule_id = self.request.query_params.get('rule')
        status_f = self.request.query_params.get('status')
        if rule_id: qs = qs.filter(rule_id=rule_id)
        if status_f: qs = qs.filter(status=status_f)
        return qs


class RunScheduledSweepView(APIView):
    """
    POST /api/personalization/run-scheduled-sweep/
    Manual trigger for the nightly batch (also callable from Celery beat —
    see tasks.py). Exposed here so an admin can force a run without waiting.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        # results = run_scheduled_rules()
        enqueue(evaluate_scheduled_targeting_rules)
        return Response({'message': 'Sweep queued — running in the background.'}, status=202)