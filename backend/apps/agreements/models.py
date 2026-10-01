from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from django.db import models, transaction

User = get_user_model()


class AgreementVersion(models.Model):
    """
    One row = one published version of the rental agreement / T&C.
    SQL table: agreements_version

    Only one version can be active at a time (enforced via save()).
    Legal team can create new versions through the admin panel without
    touching any frontend or backend code — the frontend always fetches
    the active version from the API.

    version_tag examples: 'v1.0', 'v1.1', 'v2.0'
    """
    version_tag   = models.CharField(max_length=20, unique=True,
                                     help_text="e.g. 'v1.0', 'v2.1'")
    title         = models.CharField(max_length=200,
                                     default="Rental Agreement – Terms & Conditions")
    content       = models.TextField(
        help_text=(
            "Full agreement text (Markdown supported). "
            "Editable by legal team via admin without code changes."
        )
    )
    summary       = models.TextField(
        blank=True,
        help_text="Short plain-English summary of key points, shown above the full text."
    )
    is_active     = models.BooleanField(
        default=False,
        help_text="Only ONE version can be active at a time. "
                  "Activating this will deactivate all others."
    )
    effective_from = models.DateTimeField(
        default=timezone.now,
        help_text="When this version came into legal effect."
    )
    created_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='agreement_versions_created',
        limit_choices_to={'role': 'admin'},
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agreements_version'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.version_tag} {"[ACTIVE]" if self.is_active else ""} — {self.title}'

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.is_active:
                AgreementVersion.objects.exclude(pk=self.pk).update(is_active=False)
            super().save(*args, **kwargs)
        cache.delete('agreement:active')

    @classmethod
    def get_active(cls):
        """Returns the currently active version, or None."""
        return cls.objects.filter(is_active=True).first()


class AgreementAcceptance(models.Model):
    """
    Immutable audit record of a user accepting a specific version of the agreement.
    SQL table: agreements_acceptance

    This is the legal proof layer:
    - WHO  accepted (user)
    - WHAT they accepted (agreement_version — exact content locked at that version)
    - WHEN they accepted (accepted_at)
    - HOW  they accepted (otp_verified + acceptance_method)
    - FROM WHERE (ip_address)
    - FOR WHICH booking (booking — nullable for general platform T&C)

    Records are NEVER modified after creation. If a user re-accepts, a new row is added.
    """
    ACCEPTANCE_METHODS = [
        ('otp_sign',   'OTP-Verified Digital Signature'),
        ('checkbox',   'Checkbox Acknowledgement'),
    ]

    user               = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='agreement_acceptances',
    )
    agreement_version  = models.ForeignKey(
        AgreementVersion, on_delete=models.PROTECT,
        related_name='acceptances',
        help_text="The exact version the user accepted. Never changes after creation.",
    )
    booking            = models.ForeignKey(
        'bookings.Booking', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='agreement_acceptances',
        help_text="Linked booking if this acceptance was part of a rental sign-off.",
    )

    # Immutable audit fields
    accepted_at        = models.DateTimeField(auto_now_add=True)
    ip_address         = models.GenericIPAddressField(
        null=True, blank=True,
        help_text="IP address at time of acceptance — legal proof."
    )
    user_agent         = models.TextField(
        blank=True,
        help_text="Browser/device user-agent string — additional legal context."
    )
    otp_verified       = models.BooleanField(
        default=False,
        help_text="True if acceptance was confirmed via OTP, not just checkbox."
    )
    acceptance_method  = models.CharField(
        max_length=20, choices=ACCEPTANCE_METHODS, default='checkbox',
    )

    class Meta:
        db_table = 'agreements_acceptance'
        ordering = ['-accepted_at']
        # A user may accept the same version multiple times (re-sign on new booking)
        # so no unique_together here — the booking FK differentiates them.

    def __str__(self):
        return (
            f'{self.user.email} accepted {self.agreement_version.version_tag} '
            f'at {self.accepted_at:%Y-%m-%d %H:%M} '
            f'[{self.acceptance_method}]'
        )

    def save(self, *args, **kwargs):
        """Block any modification after initial creation."""
        if self.pk:
            raise ValueError(
                "AgreementAcceptance records are immutable. "
                "Create a new record instead of modifying an existing one."
            )
        super().save(*args, **kwargs)