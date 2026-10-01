from celery import shared_task
from django.contrib.auth import get_user_model


def _chunks(iterable, size):
    batch = []
    for x in iterable:
        batch.append(x)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


@shared_task
def broadcast_notification(target_type, title, message, link_url, created_by_id, role=None, segment_id=None):
    from .utils import notify_bulk
    User   = get_user_model()
    sender = User.objects.filter(pk=created_by_id).first()

    if target_type == 'segment':
        from apps.personalization.models import Segment
        from apps.personalization.facts import build_customer_facts
        from apps.personalization.engine import user_matches_segment
        segment = Segment.objects.filter(pk=segment_id).first()
        if not segment:
            return 0
        users = (u for u in User.objects.filter(role='customer', is_active=True).iterator(chunk_size=500)
                 if user_matches_segment(segment, build_customer_facts(u)))
    elif target_type == 'role':
        users = User.objects.filter(role=role).iterator(chunk_size=1000)
    else:
        users = User.objects.all().iterator(chunk_size=1000)

    sent = 0
    for batch in _chunks(users, 1000):
        sent += notify_bulk(batch, title, message, 'admin_broadcast', link_url or '', created_by=sender)
    return sent