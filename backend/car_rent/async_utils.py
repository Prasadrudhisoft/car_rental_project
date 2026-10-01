import logging
from django.db import transaction

logger = logging.getLogger(__name__)

RETRY_POLICY = dict(
    autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=300,
    retry_jitter=True, max_retries=4,
)


def enqueue(task, *args, **kwargs):
    """
    Queue a Celery task AFTER the current DB transaction commits (so workers never
    read uncommitted rows). Never raises: a broker outage must not fail the user's request.
    Outside a transaction it runs immediately.
    """
    def _send():
        try:
            task.delay(*args, **kwargs)
        except Exception:
            logger.exception('Could not enqueue %s', getattr(task, 'name', task))
    transaction.on_commit(_send)