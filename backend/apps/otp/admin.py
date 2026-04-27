from django.contrib import admin
from .models import OTPRecord


@admin.register(OTPRecord)
class OTPRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'code', 'purpose',
        'is_used', 'expires_at', 'created_at'
    )

    list_filter = (
        'purpose', 'is_used', 'created_at'
    )

    search_fields = (
        'user__email', 'user__phone', 'code'
    )

    ordering = ('-created_at',)

    readonly_fields = (
        'code', 'created_at', 'expires_at'
    )

    fieldsets = (
        ('OTP Info', {
            'fields': ('user', 'code', 'purpose')
        }),
        ('Status', {
            'fields': ('is_used',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'expires_at')
        }),
    )