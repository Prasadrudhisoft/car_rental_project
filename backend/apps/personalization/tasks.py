from celery import shared_task
from django.contrib.auth import get_user_model

from car_rent.async_utils import RETRY_POLICY

BATCH = 200


@shared_task
def evaluate_scheduled_targeting_rules():
    User = get_user_model()
    ids = list(User.objects.filter(role='customer', is_active=True).values_list('id', flat=True))
    for i in range(0, len(ids), BATCH):
        evaluate_rules_for_users.delay(ids[i:i + BATCH])
    return {'queued_users': len(ids)}


@shared_task
def evaluate_rules_for_users(user_ids):
    from .engine import run_scheduled_rules
    User = get_user_model()
    return run_scheduled_rules(User.objects.filter(id__in=user_ids))


@shared_task(**RETRY_POLICY)
def run_event_rules_task(user_id, event_name):
    from .engine import run_event_rules
    user = get_user_model().objects.filter(pk=user_id).first()
    if user:
        run_event_rules(user, event_name)


@shared_task
def run_rule_now_task(rule_id):
    from .engine import run_rule_for_user
    from .models import TargetingRule
    rule = TargetingRule.objects.select_related('segment').filter(pk=rule_id).first()
    if not rule:
        return
    User = get_user_model()
    for u in User.objects.filter(role='customer', is_active=True).iterator(chunk_size=500):
        run_rule_for_user(rule, u)