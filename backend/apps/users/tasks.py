from celery import shared_task
from django.core.management import call_command


@shared_task
def flush_expired_tokens():
    """Simple JWT's blacklist tables grow forever otherwise."""
    call_command('flushexpiredtokens')