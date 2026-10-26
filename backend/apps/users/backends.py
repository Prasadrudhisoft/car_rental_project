from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


def find_login_matches(email, password, role=None):
    """Active accounts with this email (optionally one role) whose password matches."""
    User = get_user_model()
    qs = User.objects.filter(email__iexact=(email or '').strip())
    if role:
        qs = qs.filter(role=role)
    users = list(qs)
    if not users:
        User().set_password(password or '')          # keep timing similar for unknown emails
    return [u for u in users if u.is_active and u.check_password(password or '')]


class EmailRoleBackend(ModelBackend):
    """Email + password (+ optional role). Ambiguous matches never authenticate."""
    def authenticate(self, request, email=None, password=None, role=None, username=None, **kwargs):
        matches = find_login_matches(email or username, password, role)
        return matches[0] if len(matches) == 1 else None