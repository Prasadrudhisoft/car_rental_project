"""
Automatic model-level auditing. Connected for EVERY model in the project (see apps.py), so a new
app or model is audited the day it is created, with no per-view code.

Captured:   create / update (only the fields that changed) / delete, many-to-many changes,
            and queryset.update() / bulk_create() / bulk_update() (as one summary row with up to
            50 affected ids, because Django fires no per-row signals for those).
Who:        the authenticated user of the current request (see middleware); 'system' for Celery
            tasks and management commands; 'anonymous' for unauthenticated requests.
"""
import logging
import sys

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save

from . import context
from .services import clean, diff, jsonable, log_activity

logger = logging.getLogger(__name__)

# Never audited: the log itself, framework plumbing, secrets and high-churn technical tables.
EXCLUDED = {
    'activity.activitylog', 'sessions.session', 'admin.logentry', 'contenttypes.contenttype',
    'auth.permission', 'token_blacklist.outstandingtoken', 'token_blacklist.blacklistedtoken',
    'otp.otprecord', 'personalization.ruleexecutionlog', 'migrations.migration',
} | {m.lower() for m in getattr(settings, 'AUDIT_EXCLUDE_MODELS', [])}

APP_MODULE = {
    'users': 'profile', 'otp': 'auth', 'vehicles': 'vehicle', 'bookings': 'booking',
    'logistics': 'network', 'promotions': 'promo', 'agreements': 'agreement', 'reviews': 'review',
    'configuration': 'config', 'locations': 'config', 'notifications': 'system',
    'personalization': 'system',
}


def module_for(meta):
    name = meta.model_name
    if any(w in name for w in ('payment', 'invoice', 'refund')):
        return 'payment'
    if 'document' in name:
        return 'document'
    if meta.app_label == 'users' and ('admin' in name or 'assign' in name):
        return 'assignment'
    return APP_MODULE.get(meta.app_label, 'system')


# Management commands whose writes are infrastructure, not business actions.
_CLI_SKIP = any(c in sys.argv[1:3] for c in ('migrate', 'makemigrations', 'collectstatic', 'loaddata', 'flush'))


def tracked(model):
    if _CLI_SKIP:
        return False
    meta = model._meta
    return not (meta.auto_created or meta.abstract or meta.swapped or meta.label_lower in EXCLUDED)


def snapshot(instance):
    return {f.attname: jsonable(getattr(instance, f.attname, None)) for f in instance._meta.concrete_fields}


def _noise_fields(meta):
    return {f.attname for f in meta.concrete_fields if getattr(f, 'auto_now', False)} | {'updated_at', 'modified_at'}


def _verbose(meta):
    return str(meta.verbose_name).title()


# ── create / update / delete ────────────────────────────────────────────────
def on_pre_save(sender, instance, raw=False, **kw):
    if raw or context.is_busy() or not tracked(sender):
        return
    instance._audit_old = None
    if instance.pk is not None and not instance._state.adding:
        try:
            row = sender._base_manager.filter(pk=instance.pk).values().first()
            if row:
                instance._audit_old = {k: jsonable(v) for k, v in row.items()}
        except Exception:  # noqa
            logger.exception('audit pre_save lookup failed')


def on_post_save(sender, instance, created, raw=False, update_fields=None, **kw):
    if raw or context.is_busy() or not tracked(sender):
        return
    meta = sender._meta
    module, pk = module_for(meta), str(instance.pk)
    if created:
        log_activity(action='create', module=module, entity_type=sender.__name__, entity_id=pk,
                     summary=f'{_verbose(meta)} #{pk} created', new=snapshot(instance))
        return

    new_all = snapshot(instance)
    if update_fields:
        wanted = {meta.get_field(n).attname for n in update_fields}
        new_all = {k: v for k, v in new_all.items() if k in wanted}
    old = getattr(instance, '_audit_old', None)
    if old is None:                                     # no prior row (race / explicit pk): record new state
        o, n = {}, new_all
    else:
        o, n = diff(old, new_all)
        for k in _noise_fields(meta):
            o.pop(k, None); n.pop(k, None)
    if not n:
        return

    # A login only touches last_login on the user row -> record it as a login, not a profile edit.
    if isinstance(instance, get_user_model()) and set(n) == {'last_login'}:
        log_activity(action='login', module='auth', actor=instance, entity_type=sender.__name__,
                     entity_id=pk, summary=f'{instance} logged in')
        return

    action = 'status_change' if 'status' in n else 'update'
    log_activity(action=action, module=module, entity_type=sender.__name__, entity_id=pk,
                 summary=f'{_verbose(meta)} #{pk} updated: {", ".join(sorted(n))}', old=o, new=n)


def on_post_delete(sender, instance, **kw):
    if context.is_busy() or not tracked(sender):
        return
    meta = sender._meta
    pk = str(instance.pk)
    log_activity(action='delete', module=module_for(meta), entity_type=sender.__name__, entity_id=pk,
                 summary=f'{_verbose(meta)} #{pk} deleted', old=snapshot(instance))


def on_m2m_changed(sender, instance, action, pk_set=None, **kw):
    if action not in ('post_add', 'post_remove', 'post_clear') or context.is_busy():
        return
    model = instance.__class__
    if not tracked(model):
        return
    log_activity(action='update', module=module_for(model._meta), entity_type=model.__name__,
                 entity_id=str(instance.pk),
                 summary=f'{_verbose(model._meta)} #{instance.pk}: {sender._meta.object_name} {action[5:]}',
                 new={'related_ids': sorted(pk_set) if pk_set else []})


# ── bulk operations (no per-row signals in Django) ──────────────────────────
def install_queryset_hooks():
    from django.db.models.query import QuerySet
    if getattr(QuerySet, '_audit_installed', False):
        return
    orig_update, orig_bulk_create, orig_bulk_update = QuerySet.update, QuerySet.bulk_create, QuerySet.bulk_update

    def _log(model, action, summary, ids, extra=None):
        meta = model._meta
        log_activity(action=action, module=module_for(meta), entity_type=model.__name__,
                     entity_id=','.join(map(str, ids))[:64], summary=f'{_verbose(meta)}: {summary}',
                     new={'ids': ids[:50], **(extra or {})})

    def update(self, **kwargs):
        model = self.model
        watch = tracked(model) and not context.is_busy()
        ids = []
        if watch:
            try:
                ids = list(self.values_list('pk', flat=True)[:50])
            except Exception:  # noqa
                ids = []
        n = orig_update(self, **kwargs)
        if watch and n:
            _log(model, 'bulk_update', f'{n} row(s) updated ({", ".join(sorted(kwargs))})', ids,
                 {'count': n, 'fields': clean(kwargs)})
        return n

    def bulk_create(self, objs, *a, **kw):
        objs = list(objs)
        res = orig_bulk_create(self, objs, *a, **kw)
        if tracked(self.model) and not context.is_busy() and res:
            _log(self.model, 'create', f'{len(res)} row(s) created in bulk',
                 [o.pk for o in res if o.pk is not None], {'count': len(res)})
        return res

    def bulk_update(self, objs, fields, *a, **kw):
        objs = list(objs)
        n = orig_bulk_update(self, objs, fields, *a, **kw)
        if tracked(self.model) and not context.is_busy() and objs:
            _log(self.model, 'bulk_update', f'{len(objs)} row(s) updated in bulk ({", ".join(fields)})',
                 [o.pk for o in objs if o.pk is not None], {'count': len(objs), 'fields': list(fields)})
        return n

    QuerySet.update, QuerySet.bulk_create, QuerySet.bulk_update = update, bulk_create, bulk_update
    QuerySet._audit_installed = True


def connect():
    pre_save.connect(on_pre_save, dispatch_uid='audit_pre_save')
    post_save.connect(on_post_save, dispatch_uid='audit_post_save')
    post_delete.connect(on_post_delete, dispatch_uid='audit_post_delete')
    m2m_changed.connect(on_m2m_changed, dispatch_uid='audit_m2m')
    install_queryset_hooks()
