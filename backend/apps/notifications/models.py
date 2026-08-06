from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Notification(models.Model):
    """
    One row = one notification delivered to one user.
    SQL table: notifications_notification

    Design choice: notifications are denormalized per-recipient (not a
    single broadcast row fan-read by many users). This keeps read/unread
    state trivial to query and matches how the rest of the codebase
    favours simple per-row ownership over shared mutable state.
    """
    TYPES = [
        ('vehicle_added',        'New Vehicle Added'),
        ('vehicle_edit_pending', 'Vehicle Edit Pending Review'),
        ('vehicle_edit_decided', 'Vehicle Edit Approved/Rejected'),
        ('booking_created',      'New Booking'),
        ('admin_broadcast',      'Admin Announcement'),
        ('system',               'System'),
    ]

    recipient          = models.ForeignKey(User, on_delete=models.CASCADE,
                                            related_name='notifications')
    title               = models.CharField(max_length=200)
    message             = models.TextField()
    notification_type   = models.CharField(max_length=30, choices=TYPES, default='system')
    link_url             = models.CharField(max_length=255, blank=True,
                                            help_text="Frontend route to open when clicked, e.g. /vendor?tab=bookings")
    is_read             = models.BooleanField(default=False)
    read_at             = models.DateTimeField(null=True, blank=True)
    created_by          = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                            related_name='notifications_sent',
                                            help_text="Set only for admin-authored broadcasts; null for system-generated events.")
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f'{self.title} → {self.recipient.email}'