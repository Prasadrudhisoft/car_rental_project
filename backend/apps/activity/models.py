from django.conf import settings
from django.db import models


class ActivityLog(models.Model):
    """
    Append-only audit trail. Rows are written ONLY through
    apps.activity.services.log_activity() and are never edited or deleted
    by users or admins; the nightly purge task is the only deleter.
    actor_label / actor_role are copied at write time so the log stays
    readable after a user is deleted.
    """
    ACTIONS = [
        ('create', 'Create'), ('update', 'Update'), ('delete', 'Delete'),
        ('login', 'Login'), ('logout', 'Logout'), ('login_failed', 'Login failed'),
        ('register', 'Register'), ('status_change', 'Status change'),
        ('approve', 'Approve'), ('reject', 'Reject'), ('assign', 'Assign'),
        ('payment', 'Payment'), ('refund', 'Refund'), ('cancel', 'Cancel'),
        ('reschedule', 'Reschedule'), ('upgrade', 'Upgrade'), ('no_show', 'No-show'),
        ('upload', 'Upload'), ('bulk_update', 'Bulk update'), ('denied', 'Permission denied'),
        ('other', 'Other'),
    ]
    MODULES = [
        ('auth', 'Authentication'), ('profile', 'Profile'), ('vehicle', 'Vehicle'),
        ('document', 'Document'), ('booking', 'Booking'), ('payment', 'Payment'),
        ('network', 'Vendor network'), ('assignment', 'Admin assignment'),
        ('config', 'Configuration'), ('promo', 'Promo'), ('agreement', 'Agreement'),
        ('review', 'Review'), ('system', 'System'),
    ]

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name='+')
    actor_label = models.CharField(max_length=255, blank=True)   # email at write time
    actor_role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=20, choices=ACTIONS)
    module = models.CharField(max_length=20, choices=MODULES)
    entity_type = models.CharField(max_length=50, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    summary = models.CharField(max_length=500, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    request_id = models.CharField(max_length=32, blank=True, db_index=True)   # ties rows from one API call
    http_method = models.CharField(max_length=8, blank=True)
    path = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'activity_log'
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['module', 'action', '-created_at'], name='act_mod_act_idx'),
            models.Index(fields=['actor', '-created_at'], name='act_actor_idx'),
            models.Index(fields=['entity_type', 'entity_id'], name='act_entity_idx'),
        ]

    def __str__(self):
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {self.actor_label} {self.action} {self.module}'
