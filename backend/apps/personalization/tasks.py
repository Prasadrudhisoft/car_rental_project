from celery import shared_task

@shared_task
def evaluate_scheduled_targeting_rules():
    from .engine import run_scheduled_rules
    return run_scheduled_rules()