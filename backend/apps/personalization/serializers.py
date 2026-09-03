from rest_framework import serializers
from .models import Segment, TargetingRule, RuleExecutionLog


class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = ['id', 'name', 'description', 'conditions', 'is_active', 'created_at', 'updated_at']


class TargetingRuleSerializer(serializers.ModelSerializer):
    segment_name = serializers.CharField(source='segment.name', read_only=True)

    class Meta:
        model = TargetingRule
        fields = ['id', 'name', 'description', 'segment', 'segment_name',
                  'trigger_type', 'event_name', 'action_type', 'action_config',
                  'cooldown_days', 'priority', 'stop_on_match', 'is_active',
                  'created_at', 'updated_at']


class RuleExecutionLogSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = RuleExecutionLog
        fields = ['id', 'rule', 'rule_name', 'user', 'user_email', 'status', 'detail', 'executed_at']