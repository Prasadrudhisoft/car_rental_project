from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

OPERATORS = [
    ('eq', 'Equals'), ('neq', 'Not equals'),
    ('gt', 'Greater than'), ('gte', 'Greater than or equal'),
    ('lt', 'Less than'), ('lte', 'Less than or equal'),
    ('in', 'In list'), ('not_in', 'Not in list'),
    ('contains', 'Contains'),
    ('is_true', 'Is true'), ('is_false', 'Is false'),
]


class Segment(models.Model):
    """
    A named, reusable audience definition. `conditions` is a list of
    {field, op, value} dicts, ANDed together. Kept as JSON (not a
    query-string DSL) so the admin UI can build it with plain dropdowns —
    no code, no injection risk, no parser to maintain.
    """
    name        = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    conditions  = models.JSONField(default=list)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personalization_segment'
        ordering = ['name']

    def __str__(self):
        return self.name


class TargetingRule(models.Model):
    """
    One row = one "if a user is in Segment X, do Action Y" policy.
    """
    ACTION_TYPES = [
        ('notification',  'Send Notification'),
        ('promo_code',    'Grant Promo Code'),
        ('loyalty_bonus', 'Credit Loyalty Points'),
    ]
    TRIGGER_TYPES = [
        ('scheduled', 'Scheduled (nightly batch)'),
        ('event',     'Event-driven (real-time)'),
    ]
    EVENT_CHOICES = [
        ('signup',            'Customer Signed Up'),
        ('booking_completed', 'Booking Completed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('payment_pending',   'Booking Created, Payment Not Captured'),
        ('review_submitted',  'Review Submitted'),
        ('kyc_incomplete',    'KYC Still Incomplete Post-Signup'),
    ]

    name          = models.CharField(max_length=150)
    description   = models.TextField(blank=True)
    segment       = models.ForeignKey(Segment, on_delete=models.PROTECT, related_name='rules')

    trigger_type  = models.CharField(max_length=20, choices=TRIGGER_TYPES, default='scheduled')
    event_name    = models.CharField(max_length=40, choices=EVENT_CHOICES, blank=True)

    action_type   = models.CharField(max_length=20, choices=ACTION_TYPES)
    action_config = models.JSONField(default=dict, help_text=(
        "notification: {title, message, link_url} — supports {{first_name}}, "
        "{{loyalty_points}}, {{days_since_last_booking}} placeholders. "
        "promo_code: {code_prefix, discount_type, discount_value, valid_days}. "
        "loyalty_bonus: {points}."
    ))

    cooldown_days   = models.PositiveIntegerField(default=30, help_text="Minimum days between repeat triggers for the same user.")
    priority        = models.PositiveIntegerField(default=100, help_text="Lower runs first when multiple scheduled rules match the same user.")
    stop_on_match   = models.BooleanField(default=False, help_text="If true, no further scheduled rules run for this user in the same batch.")
    is_active       = models.BooleanField(default=True)

    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personalization_targetingrule'
        ordering = ['priority', 'name']

    def __str__(self):
        return f'{self.name} → {self.segment.name} → {self.action_type}'


class RuleExecutionLog(models.Model):
    """
    Immutable audit trail. Also doubles as the cooldown store — "has this
    rule fired for this user within cooldown_days" is answered by querying
    this table, not by caching state elsewhere.
    """
    STATUS = [
        ('sent',              'Action executed'),
        ('skipped_cooldown',  'Skipped — cooldown active'),
        ('skipped_no_match',  'Skipped — facts no longer match'),
        ('error',             'Error during execution'),
    ]
    rule        = models.ForeignKey(TargetingRule, on_delete=models.CASCADE, related_name='logs')
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='personalization_logs')
    status      = models.CharField(max_length=20, choices=STATUS)
    detail      = models.TextField(blank=True)
    facts_snapshot = models.JSONField(default=dict, blank=True)
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'personalization_ruleexecutionlog'
        ordering = ['-executed_at']
        indexes = [models.Index(fields=['rule', 'user', 'executed_at'])]