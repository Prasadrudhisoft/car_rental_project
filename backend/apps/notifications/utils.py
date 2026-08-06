"""
Central helpers other apps use to raise notifications. This is the ONE
place new event types get wired through, keeping the feature scalable:
adding a new automated notification elsewhere in the codebase is just
one `notify(...)` or `notify_bulk(...)` call at the point the event
happens — no new plumbing needed here.
"""
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()


def notify(recipient, title, message, notification_type='system', link_url='', created_by=None):
    if recipient is None:
        return None
    return Notification.objects.create(
        recipient=recipient, title=title, message=message,
        notification_type=notification_type, link_url=link_url, created_by=created_by,
    )


def notify_bulk(recipients, title, message, notification_type='system', link_url='', created_by=None):
    recipients = [r for r in recipients if r is not None]
    if not recipients:
        return 0
    objs = [
        Notification(
            recipient=r, title=title, message=message,
            notification_type=notification_type, link_url=link_url, created_by=created_by,
        )
        for r in recipients
    ]
    Notification.objects.bulk_create(objs)
    return len(objs)


def notify_admins_for_vendor(vendor_user, title, message, notification_type='system', link_url=''):
    """
    Notifies the vendor's assigned admin if one exists (respecting the
    existing scoped-admin system), else falls back to all superadmins,
    else all admins. Mirrors the scoping logic already used in
    apps.users.views (_get_admin_profile / VendorAdminAssignment).
    """
    from apps.users.models import VendorAdminAssignment

    assignment = VendorAdminAssignment.objects.filter(
        vendor=vendor_user, is_active=True
    ).select_related('admin').first()

    if assignment:
        recipients = [assignment.admin]
    else:
        recipients = list(User.objects.filter(role='admin', admin_profile__scope='superadmin'))
        if not recipients:
            recipients = list(User.objects.filter(role='admin'))

    notify_bulk(recipients, title, message, notification_type, link_url)