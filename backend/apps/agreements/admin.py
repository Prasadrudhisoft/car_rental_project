from django.contrib import admin
from django.utils.html import format_html
from .models import AgreementVersion, AgreementAcceptance


@admin.register(AgreementVersion)
class AgreementVersionAdmin(admin.ModelAdmin):
    """
    Admin interface for legal team to manage T&C versions.
    Legal teams can create and edit versions here without touching code.
    """
    list_display  = ('version_tag', 'title', 'is_active_badge', 'effective_from',
                     'acceptance_count', 'created_by', 'created_at')
    list_filter   = ('is_active', 'created_at')
    search_fields = ('version_tag', 'title', 'content')
    readonly_fields = ('created_at', 'updated_at', 'acceptance_count_detail')
    ordering      = ('-created_at',)

    fieldsets = (
        ('Identity', {
            'fields': ('version_tag', 'title', 'is_active', 'effective_from'),
        }),
        ('Content', {
            'fields': ('summary', 'content'),
            'description': (
                'Write the agreement content in plain text or Markdown. '
                'The frontend renders it as-is. '
                'Create a NEW version instead of editing an active one.'
            ),
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_at', 'acceptance_count_detail'),
            'classes': ('collapse',),
        }),
    )

    def is_active_badge(self, obj):
        if obj.is_active:
            return format_html(
                '<span style="color:{};font-weight:bold;">{}</span>',
                'green',
                '✅ ACTIVE'
            )
        return format_html(
            '<span style="color:{};">{}</span>',
            '#999',
            'Draft'
        )
    is_active_badge.short_description = 'Status'

    def acceptance_count(self, obj):
        count = obj.acceptances.count()
        return format_html('<strong>{}</strong>', count)
    acceptance_count.short_description = 'Acceptances'

    def acceptance_count_detail(self, obj):
        if not obj.pk:
            return '—'
        count = obj.acceptances.count()
        otp_count = obj.acceptances.filter(otp_verified=True).count()
        return format_html(
            '{} total ({} OTP-verified)',
            count, otp_count
        )
    acceptance_count_detail.short_description = 'Acceptance Stats'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        # Once a version has acceptances, block editing content (legal integrity)
        if obj and obj.pk and obj.acceptances.exists():
            readonly += ['content', 'version_tag']
        return readonly


@admin.register(AgreementAcceptance)
class AgreementAcceptanceAdmin(admin.ModelAdmin):
    """
    Read-only audit log. Never editable — immutable legal records.
    """
    list_display  = ('user', 'agreement_version', 'booking_ref',
                     'accepted_at', 'otp_verified', 'acceptance_method', 'ip_address')
    list_filter   = ('otp_verified', 'acceptance_method', 'agreement_version', 'accepted_at')
    search_fields = ('user__email', 'user__full_name', 'ip_address',
                     'agreement_version__version_tag')
    ordering      = ('-accepted_at',)
    readonly_fields = (
        'user', 'agreement_version', 'booking', 'accepted_at',
        'ip_address', 'user_agent', 'otp_verified', 'acceptance_method',
    )

    def booking_ref(self, obj):
        return obj.booking.booking_ref if obj.booking else '—'
    booking_ref.short_description = 'Booking'

    def has_add_permission(self, request):
        return False  # Never allow manual creation

    def has_change_permission(self, request, obj=None):
        return False  # Never allow editing

    def has_delete_permission(self, request, obj=None):
        return False  # Never allow deletion — these are legal records