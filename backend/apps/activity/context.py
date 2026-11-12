"""Per-request audit context (who/where) shared by the middleware, signals and log_activity()."""
import contextvars
import uuid

_state = contextvars.ContextVar('audit_state', default=None)
_busy = contextvars.ContextVar('audit_busy', default=False)


def start(request):
    return _state.set({'request': request, 'id': uuid.uuid4().hex, 'user': None, 'label': ''})


def stop(token):
    _state.reset(token)


def current_request():
    s = _state.get()
    return s['request'] if s else None


def current_request_id():
    s = _state.get()
    return s['id'] if s else ''


def is_busy():
    return _busy.get()


class busy:
    """While active, signal handlers ignore writes (prevents the audit log auditing itself)."""
    def __enter__(self):
        self._t = _busy.set(True)

    def __exit__(self, *a):
        _busy.reset(self._t)


class suppress(busy):
    """Use around seed scripts / data migrations that should not be audited:  with suppress(): ..."""


def _user_from_token(raw):
    try:
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.settings import api_settings
        from rest_framework_simplejwt.tokens import UntypedToken
        # UntypedToken checks signature + expiry only (not the blacklist), so it also works for a
        # refresh token that the view has just blacklisted during logout.
        uid = UntypedToken(raw)[api_settings.USER_ID_CLAIM]
        return get_user_model().objects.filter(pk=uid).first()
    except Exception:  # noqa
        return None


def set_user(user):
    s = _state.get()
    if s is not None:
        s['user'] = user


def set_label(label):
    """Unverified identifier claimed in the request body (email/username) - shown only for anonymous rows."""
    s = _state.get()
    if s is not None and label:
        s['label'] = str(label)[:255]


def current_label():
    s = _state.get()
    return s['label'] if s else ''


def fallback_user(request):
    """User proven by a valid Bearer token even though DRF did not authenticate this view."""
    s = _state.get()
    if s is None:
        return None
    if s['user'] is None:
        header = request.META.get('HTTP_AUTHORIZATION', '') if request is not None else ''
        if header.lower().startswith('bearer '):
            s['user'] = _user_from_token(header[7:].strip())
    return s['user']


def user_from_token(raw):
    return _user_from_token(raw)