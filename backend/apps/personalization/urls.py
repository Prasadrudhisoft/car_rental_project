from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SegmentViewSet, TargetingRuleViewSet, RuleExecutionLogListView, RunScheduledSweepView

router = DefaultRouter()
router.register('segments', SegmentViewSet, basename='segment')
router.register('rules', TargetingRuleViewSet, basename='targeting-rule')
router.register('logs', RuleExecutionLogListView, basename='rule-log')

urlpatterns = [
    path('', include(router.urls)),
    path('run-scheduled-sweep/', RunScheduledSweepView.as_view(), name='run-scheduled-sweep'),
]