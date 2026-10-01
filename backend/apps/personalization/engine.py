"""
The rule engine itself. Deliberately small and dependency-free: it just
walks a list of {field, op, value} dicts against a facts dict, and — if
they all pass — dispatches to the configured action. No template language,
no external DSL parser, so it's auditable at a glance.
"""
import logging
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)


def _coerce(actual, expected):
    """
    Condition values arrive from the UI as plain strings even for numeric
    facts. Align expected's type to actual's type before comparing so
    "60" correctly compares against the real int 65.
    """
    if isinstance(actual, bool):
        return expected  # is_true/is_false ops don't need this
    if isinstance(actual, (int, float)) and isinstance(expected, str):
        try:
            return float(expected) if '.' in expected else int(expected)
        except ValueError:
            return expected
    return expected


def _cmp(op, actual, expected):
    if actual is None:
        return False
    try:
        if op in ('in', 'not_in'):
            # Support a comma-separated string from the UI as a pseudo-list
            if isinstance(expected, str):
                expected = [v.strip() for v in expected.split(',')]
        else:
            expected = _coerce(actual, expected)

        if op == 'eq':        return actual == expected
        if op == 'neq':       return actual != expected
        if op == 'gt':        return actual > expected
        if op == 'gte':       return actual >= expected
        if op == 'lt':        return actual < expected
        if op == 'lte':       return actual <= expected
        if op == 'in':        return str(actual) in expected
        if op == 'not_in':    return str(actual) not in expected
        if op == 'contains':  return expected in (actual or '')
        if op == 'is_true':   return bool(actual) is True
        if op == 'is_false':  return bool(actual) is False
    except TypeError:
        return False
    return False


def evaluate_conditions(conditions: list, facts: dict) -> bool:
    """All conditions must pass (AND). Empty condition list matches everyone."""
    for cond in conditions:
        field, op, expected = cond.get('field'), cond.get('op'), cond.get('value')
        print(f"Evaluating condition from start to check whether it matches: field={field}, op={op}, expected={expected}, facts={facts}")
        if not _cmp(op, facts.get(field), expected):
            return False
    return True


def user_matches_segment(segment, facts: dict) -> bool:
    if not segment.is_active:
        return False
    return evaluate_conditions(segment.conditions, facts)


def _render_template(text: str, facts: dict) -> str:
    if not text:
        return text
    for key, val in facts.items():
        text = text.replace('{{' + key + '}}', str(val))
    return text


def _in_cooldown(rule, user) -> bool:
    from .models import RuleExecutionLog
    if rule.cooldown_days <= 0:
        return False
    cutoff = timezone.now() - timedelta(days=rule.cooldown_days)
    return RuleExecutionLog.objects.filter(
        rule=rule, user=user, status='sent', executed_at__gte=cutoff
    ).exists()


def execute_action(rule, user, facts: dict):
    """Dispatches to the configured action type. Returns (status, detail)."""
    cfg = rule.action_config or {}

    if rule.action_type == 'notification':
        from apps.notifications.utils import notify
        notify(
            user,
            title=_render_template(cfg.get('title', ''), facts),
            message=_render_template(cfg.get('message', ''), facts),
            notification_type='admin_broadcast',
            link_url=cfg.get('link_url', ''),
        )
        return 'sent', 'Notification delivered.'

    if rule.action_type == 'promo_code':
        from apps.promotions.models import PromoCode
        code = f"{cfg.get('code_prefix', 'PROMO')}{user.id}{int(timezone.now().timestamp()) % 10000}"
        valid_days = cfg.get('valid_days', 14)
        PromoCode.objects.create(
            code=code,
            description=f"Auto-granted via rule: {rule.name}",
            discount_type=cfg.get('discount_type', 'percentage'),
            discount_value=cfg.get('discount_value', 10),
            max_discount_cap=cfg.get('max_discount_cap'),
            min_booking_value=cfg.get('min_booking_value', 0),
            is_single_use=True,
            max_redemptions=1,
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(days=valid_days),
            is_active=True,
        )
        from apps.notifications.utils import notify
        notify(
            user,
            title=cfg.get('notify_title', "Here's a promo code for you!"),
            message=_render_template(
                cfg.get('notify_message', f"Use code {code} on your next booking."), facts
            ).replace('{{code}}', code),
            notification_type='admin_broadcast',
            link_url='/book/select-car',
        )
        return 'sent', f'Promo code {code} granted.'

    if rule.action_type == 'loyalty_bonus':
        points = int(cfg.get('points', 0))
        profile = getattr(user, 'customer_profile', None)
        if not profile or points <= 0:
            return 'error', 'No customer profile or invalid points.'
        from django.db.models import F
        type(profile).objects.filter(pk=profile.pk).update(loyalty_points=F('loyalty_points') + points)
        from apps.notifications.utils import notify
        notify(
            user,
            title="You've earned bonus loyalty points!",
            message=f"{points} points have been credited to your account.",
            notification_type='admin_broadcast',
            link_url='/customer?tab=loyalty',
        )
        return 'sent', f'{points} points credited.'

    return 'error', f'Unknown action_type {rule.action_type}'


def run_rule_for_user(rule, user, facts: dict = None):
    """Evaluates one rule against one user, respecting cooldown, and logs the result."""
    from .models import RuleExecutionLog

    if facts is None:
        from .facts import build_customer_facts
        facts = build_customer_facts(user)

    if not rule.is_active:
        return None

    if not user_matches_segment(rule.segment, facts):
        return None  # silent — this user was never a candidate this run

    if _in_cooldown(rule, user):
        RuleExecutionLog.objects.create(
            rule=rule, user=user, status='skipped_cooldown',
            detail='Cooldown active.', facts_snapshot=facts,
        )
        return 'skipped_cooldown'

    try:
        status, detail = execute_action(rule, user, facts)
    except Exception as e:
        logger.exception('Rule %s failed for user %s', rule.id, user.id)
        status, detail = 'error', str(e)

    RuleExecutionLog.objects.create(
        rule=rule, user=user, status=status, detail=detail, facts_snapshot=facts,
    )
    return status


def run_scheduled_rules(user_qs=None):
    """
    The nightly batch sweep. For each active customer, builds facts once
    and evaluates all active scheduled rules in priority order, stopping
    early per-user if a matched rule has stop_on_match=True.
    """
    from django.contrib.auth import get_user_model
    from .models import TargetingRule
    from .facts import build_customer_facts

    User = get_user_model()
    users = user_qs if user_qs is not None else User.objects.filter(role='customer', is_active=True)
    rules = list(TargetingRule.objects.filter(
        is_active=True, trigger_type='scheduled'
    ).select_related('segment').order_by('priority'))

    results = {'evaluated_users': 0, 'actions_sent': 0}
    for user in users.iterator():
        facts = build_customer_facts(user)
        results['evaluated_users'] += 1
        for rule in rules:
            status = run_rule_for_user(rule, user, facts)
            if status == 'sent':
                results['actions_sent'] += 1
                if rule.stop_on_match:
                    break
    return results


def run_event_rules(user, event_name: str):
    """Runs in a Celery worker (see tasks.run_event_rules_task)."""
    from .models import TargetingRule
    from .facts import build_customer_facts
    rules = list(TargetingRule.objects.filter(
        is_active=True, trigger_type='event', event_name=event_name
    ).select_related('segment').order_by('priority'))
    if not rules:
        return
    facts = build_customer_facts(user)
    for rule in rules:
        run_rule_for_user(rule, user, facts)