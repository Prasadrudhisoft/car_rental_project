import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from . import context
from .models import ActivityLog

logger = logging.getLogger(__name__)

# Exact field names that are always masked, plus substrings that mask any field containing them.
SENSITIVE_EXACT = {'password', 'otp', 'otp_code', 'code_hash', 'pan', 'pan_number', 'aadhaar',
                   'aadhaar_number', 'refresh', 'access', 'authorization', 'cvv', 'card_number'}
SENSITIVE_PARTS = ('password', 'secret', 'token', 'signature', 'aadhaar', 'licence', 'license_number',
                   'api_key')


def is_sensitive(key):
    k = str(key).lower()
    return k in SENSITIVE_EXACT or any(p in k for p in SENSITIVE_PARTS)


def client_ip(request):
    """Honours REST_FRAMEWORK['NUM_PROXIES'] like DRF does, so a spoofed X-Forwarded-For is not trusted."""
    if request is None:
        return None
    meta = request.META
    num = (getattr(settings, 'REST_FRAMEWORK', {}) or {}).get('NUM_PROXIES')
    xff = meta.get('HTTP_X_FORWARDED_FOR')
    if num and xff:
        addrs = [a.strip() for a in xff.split(',') if a.strip()]
        if addrs:
            return addrs[-min(num, len(addrs))]
    return meta.get('REMOTE_ADDR')


def jsonable(v, limit=300, _depth=0):
    """JSON-safe copy. Recurses into dict/list (masking secret keys at any depth); Decimals are
    compared by value so 10 and 10.00 are not reported as a change."""
    if v is None or isinstance(v, (bool, int, float)):
        return v
    if isinstance(v, Decimal):
        return format(v.normalize(), 'f') if v.is_finite() else str(v)
    if hasattr(v, 'resolve_expression'):          # F()/Value() expressions
        return '<expression>'
    if isinstance(v, (bytes, bytearray)):
        return '<bytes>'
    if hasattr(v, 'name') and hasattr(v, 'storage'):   # FieldFile
        return v.name or ''
    if _depth < 5 and isinstance(v, dict):
        return {str(k): ('***' if is_sensitive(k) else jsonable(x, limit, _depth + 1)) for k, x in v.items()}
    if _depth < 5 and isinstance(v, (list, tuple, set)):
        return [jsonable(x, limit, _depth + 1) for x in list(v)[:100]]
    s = str(v)
    return s if len(s) <= limit else s[:limit] + '…'


def clean(values):
    """Mask secrets and make everything JSON-safe."""
    if not isinstance(values, dict):
        return jsonable(values)
    return jsonable(values)


def diff(old: dict, new: dict):
    keys = [k for k in new if old.get(k) != new.get(k)]
    return {k: old.get(k) for k in keys}, {k: new[k] for k in keys}


def log_activity(*, action, module, request=None, actor=None, entity=None, entity_type='', entity_id='',
                 summary='', old=None, new=None, request_id=None, http_method='', path=''):
    """
    Writes one audit row. Never raises. Runs inside a savepoint so a logging failure cannot poison the
    caller's transaction, and the row rolls back together with the data change it describes.
    """
    if context.is_busy():
        return
    try:
        request = request or context.current_request()
        user = getattr(request, 'user', None)
        if actor is None and user is not None and getattr(user, 'is_authenticated', False):
            actor = user
        if actor is None and request is not None:                       # NEW
            actor = context.fallback_user(request)  
        if entity is not None:
            entity_type = entity_type or entity.__class__.__name__
            entity_id = entity_id or str(getattr(entity, 'pk', ''))
        if actor is not None:
            label = getattr(actor, 'email', '') or getattr(actor, 'username', '') or str(actor.pk)
            role = getattr(actor, 'role', '') or ('admin' if getattr(actor, 'is_superuser', False) else '')
        else:
            label = (context.current_label() or 'anonymous') if request is not None else 'system'
            role = ''
        with context.busy():
            with transaction.atomic():
                ActivityLog.objects.create(
                    actor=actor if actor is not None and getattr(actor, 'pk', None) else None,
                    actor_label=label[:255], actor_role=role[:20],
                    action=action, module=module,
                    entity_type=entity_type[:50], entity_id=str(entity_id)[:64],
                    summary=summary[:500],
                    old_values=clean(old), new_values=clean(new),
                    ip_address=client_ip(request),
                    request_id=request_id or context.current_request_id(),
                    http_method=(http_method or getattr(request, 'method', '') or '')[:8],
                    path=(path or getattr(request, 'path', '') or '')[:255],
                )
    except Exception:  # noqa
        logger.exception('activity log write failed')
