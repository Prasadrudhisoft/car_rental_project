from django.contrib import admin
from .models import User, CustomerProfile, VendorProfile, SavedAddress, AdminProfile, VendorAdminAssignment


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

    fieldsets = (
        ('Vendor Info', {
            'fields': ('user', 'business_name', 'gstin', 'status', 'admin_note')
        }),
        ('KYC Details', {
            'fields': ('aadhaar_number', 'pan_number', 'kyc_document')
        }),
        ('Bank Details', {
            'fields': ('bank_account_name', 'bank_account_no', 'bank_ifsc')
        }),
        ('Business Address', {
            'fields': ('addr_line1', 'addr_line2', 'addr_line3', 'city', 'state', 'country', 'pincode')
        }),
        ('Map Location', {
            'fields': ('latitude', 'longitude', 'pickup_location')
        }),
        ('Shop Hours', {
            'fields': ('shop_opening_time', 'shop_closing_time')
        }),
        ('Ratings & Memberships', {
            'fields': ('rating', 'total_reviews', 'is_cooperation_member')
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at')
        }),
    )


# -------------------- SAVED ADDRESS --------------------

@admin.register(SavedAddress)
class SavedAddressAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'customer', 'label',
        'city', 'pincode', 'is_default'
    )

    list_filter = ('city', 'is_default')
    search_fields = ('label', 'city', 'pincode')


# -------------------- ADMIN PROFILE --------------------

@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'scope', 'display_name', 'created_at'
    )

    list_filter = ('scope',)
    search_fields = ('user__email', 'user__full_name', 'display_name')

    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Admin Info', {
            'fields': ('user', 'scope', 'display_name', 'notes')
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Only show admins (role='admin') as per model limit_choices_to
        return qs.select_related('user')


# -------------------- VENDOR ADMIN ASSIGNMENT --------------------

@admin.register(VendorAdminAssignment)
class VendorAdminAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'get_vendor_business', 'get_admin_name',
        'is_active', 'assigned_at', 'get_assigned_by'
    )

    list_filter = ('is_active', 'assigned_at')
    search_fields = (
        'vendor__email', 'vendor__full_name',
        'admin__email', 'admin__full_name',
        'vendor__vendor_profile__business_name'
    )

    readonly_fields = ('assigned_at', 'deactivated_at')

    raw_id_fields = ('admin', 'vendor', 'assigned_by')

    fieldsets = (
        ('Assignment', {
            'fields': ('admin', 'vendor', 'is_active', 'notes')
        }),
        ('Audit Info', {
            'fields': ('assigned_at', 'assigned_by', 'deactivated_at')
        }),
    )

    def get_vendor_business(self, obj):
        try:
            return obj.vendor.vendor_profile.business_name
        except:
            return obj.vendor.email
    get_vendor_business.short_description = 'Vendor'
    get_vendor_business.admin_order_field = 'vendor__vendor_profile__business_name'

    def get_admin_name(self, obj):
        return obj.admin.full_name or obj.admin.email
    get_admin_name.short_description = 'Admin'
    get_admin_name.admin_order_field = 'admin__full_name'

    def get_assigned_by(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.full_name or obj.assigned_by.email
        return '—'
    get_assigned_by.short_description = 'Assigned By'
    get_assigned_by.admin_order_field = 'assigned_by__full_name'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('admin', 'vendor', 'assigned_by', 'vendor__vendor_profile')