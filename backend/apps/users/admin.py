from django.contrib import admin
from .models import User, CustomerProfile, VendorProfile, SavedAddress


# -------------------- INLINES --------------------

class CustomerProfileInline(admin.StackedInline):
    model = CustomerProfile
    can_delete = False
    extra = 0


class VendorProfileInline(admin.StackedInline):
    model = VendorProfile
    can_delete = False
    extra = 0


class SavedAddressInline(admin.TabularInline):
    model = SavedAddress
    extra = 0


# -------------------- USER ADMIN --------------------

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'email', 'phone', 'full_name',
        'role', 'is_active', 'is_staff',
        'is_email_verified', 'is_phone_verified',
        'date_joined'
    )

    list_filter = (
        'role', 'is_active', 'is_staff',
        'is_email_verified', 'is_phone_verified'
    )

    search_fields = ('email', 'phone', 'full_name')
    ordering = ('-date_joined',)

    readonly_fields = ('date_joined',)

    fieldsets = (
        ('Basic Info', {
            'fields': ('email', 'password', 'full_name', 'phone', 'role')
        }),
        ('Verification', {
            'fields': ('is_email_verified', 'is_phone_verified')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Dates', {
            'fields': ('date_joined',)
        }),
    )

    inlines = [CustomerProfileInline, VendorProfileInline]


# -------------------- CUSTOMER PROFILE --------------------

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'loyalty_points', 'kyc_status'
    )

    list_filter = ('kyc_status',)
    search_fields = ('user__email', 'user__phone', 'user__full_name')

    inlines = [SavedAddressInline]


# -------------------- VENDOR PROFILE --------------------

@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'business_name', 'user',
        'status', 'rating', 'total_reviews',
        'is_cooperation_member', 'created_at'
    )

    list_filter = ('status', 'is_cooperation_member')
    search_fields = ('business_name', 'user__email', 'user__phone')

    readonly_fields = ('created_at', 'updated_at')


# -------------------- SAVED ADDRESS --------------------

@admin.register(SavedAddress)
class SavedAddressAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'customer', 'label',
        'city', 'pincode', 'is_default'
    )

    list_filter = ('city', 'is_default')
    search_fields = ('label', 'city', 'pincode')