"""
Request-level auditing. For every state-changing API call (POST/PUT/PATCH/DELETE) it records WHO called
WHAT, with the (secret-masked) JSON payload and the result. Also:
  * binds the user/IP/request-id to the model-level signal rows written during the same request, and
  * records logins, failed logins, logouts, registrations and permission denials.
Place it LAST in MIDDLEWARE.
"""
import json
import re

from . import context
from .services import clean, log_activity

MUTATING = {'POST', 'PUT', 'PATCH', 'DELETE'}
# POSTs that only compute/validate and change nothing.
READ_ONLY_POSTS = ('/bookings/price-preview/', '/modify/quote/', '/promos/validate/',
                   '/users/token/refresh/', '/otp/send/', '/activity/')
MAX_BODY = 64 * 1024

SEGMENT_MODULE = {
    'users': 'profile', 'otp': 'auth', 'vehicles': 'vehicle', 'bookings': 'booking', 'logistics': 'network',
    'promos': 'promo', 'agreements': 'agreement', 'reviews': 'review', 'configuration': 'config',
    'locations': 'config', 'notifications': 'system', 'personalization': 'system',
}
KEYWORD_ACTION = [
    ('login', 'login'), ('logout', 'logout'), ('register', 'register'), ('no-show', 'no_show'),
    ('reschedule', 'reschedule'), ('refund', 'refund'), ('cancel', 'cancel'), ('approve', 'approve'),
    ('reject', 'reject'), ('assign', 'assign'), ('payment', 'payment'), ('webhook', 'payment'),
    ('/pay/', 'payment'), ('upload', 'upload'), ('/photos/', 'upload'), ('/docs/', 'upload'),
]


def _module(path):
    p = path.lower()
    if 'payment' in p or 'webhook' in p or '/modify/pay/' in p:
        return 'payment'
    if '/docs/' in p or '/submit-docs/' in p:
        return 'document'
    if 'assign' in p or '/admin/create' in p:
        return 'assignment'
    parts = [s for s in p.split('/') if s]
    seg = parts[1] if len(parts) > 1 and parts[0] == 'api' else (parts[0] if parts else '')
    return SEGMENT_MODULE.get(seg, 'system')


def _action(path, method):
    p = path.lower()
    for kw, act in KEYWORD_ACTION:
        if kw in p:
            return act
    return {'POST': 'create', 'PUT': 'update', 'PATCH': 'update', 'DELETE': 'delete'}[method]


def _entity(path):
    m = re.findall(r'/([a-z][a-z_\-]*)/(\d+)/', path.lower() + '/')
    return (m[-1][0], m[-1][1]) if m else ('', '')


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _body(request):
        if request.method not in MUTATING or not request.path.startswith('/api/'):
            return None
        if not (request.content_type or '').startswith('application/json'):
            return None
        try:
            if int(request.META.get('CONTENT_LENGTH') or 0) > MAX_BODY:
                return None
            data = json.loads(request.body or b'{}')   # caching request.body keeps it readable for DRF
            return data if isinstance(data, dict) else {'_': data}
        except Exception:  # noqa
            return None

    def __call__(self, request):
        body = self._body(request)
        token = context.start(request)
        try:
            if body:
                context.set_label(body.get('email') or body.get('username'))
                if request.path.rstrip('/').endswith('/users/logout') and body.get('refresh'):
                    context.set_user(context.user_from_token(body['refresh']))
            response = self.get_response(request)
            try:
                self._record(request, response, body)
            except Exception:  # noqa  - auditing must never break a response
                import logging
                logging.getLogger(__name__).exception('audit middleware failed')
            return response
        finally:
            context.stop(token)

    # ------------------------------------------------------------------
    def _record(self, request, response, body):
        path, method, status = request.path, request.method, response.status_code
        if method not in MUTATING or not path.startswith('/api/'):
            return
        if any(s in path for s in READ_ONLY_POSTS):
            return
        is_login = path.rstrip('/').endswith('/users/login')
        payload = clean(body) if body else None
        ident = (body or {}).get('email') or (body or {}).get('username') or ''

        if is_login and status != 200:
            log_activity(action='login_failed', module='auth', request=request, http_method=method, path=path,
                         summary=f'Failed login for {ident or "unknown"} (HTTP {status})',
                         new={'identifier': ident})
            return
        if status == 403:
            log_activity(action='denied', module=_module(path), request=request, http_method=method, path=path,
                         summary=f'Permission denied: {method} {path}', new=payload)
            return
        if status >= 400:
            return                                    # failed validation etc. changed nothing

        actor = None
        if is_login:                                  # request.user is anonymous on login: read the issued token
            actor = self._user_from_login(response)
        etype, eid = _entity(path)
        action = _action(path, method)
        log_activity(action=action, module='auth' if is_login or action in ('logout', 'register') else _module(path),
                     request=request, actor=actor, http_method=method, path=path,
                     entity_type=etype, entity_id=eid,
                     summary=(f'{ident} logged in' if is_login and ident else f'{method} {path} → {status}'),
                     new=payload)

    @staticmethod
    def _user_from_login(response):
        try:
            from django.contrib.auth import get_user_model
            from rest_framework_simplejwt.settings import api_settings
            from rest_framework_simplejwt.tokens import AccessToken
            access = json.loads(response.content).get('access')
            if access:
                uid = AccessToken(access)[api_settings.USER_ID_CLAIM]
                return get_user_model().objects.filter(pk=uid).first()
        except Exception:  # noqa
            pass
        return None
