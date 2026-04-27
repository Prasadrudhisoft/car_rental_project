from django.contrib import admin
from .models import VendorNetwork, ReturnPoint, HandoverRecord, HandoverPhoto, RevenueShare
 
@admin.register(VendorNetwork)
class VendorNetworkAdmin(admin.ModelAdmin):
    list_display  = ["vendor", "city", "is_active", "max_vehicles", "joined_at"]
    list_filter   = ["city", "is_active"]
    search_fields = ["vendor__full_name", "vendor__vendor_profile__business_name"]
 
@admin.register(ReturnPoint)
class ReturnPointAdmin(admin.ModelAdmin):
    list_display  = ["name", "city", "point_type", "is_active"]
    list_filter   = ["city", "point_type", "is_active"]
    search_fields = ["name", "address"]
 
@admin.register(HandoverRecord)
class HandoverRecordAdmin(admin.ModelAdmin):
    list_display  = ["booking", "return_point", "receiving_vendor",
                      "status", "handover_confirmed_at", "full_inspection_done"]
    list_filter   = ["status", "deposit_hold_extended"]
    readonly_fields = ["created_at", "updated_at"]
 
@admin.register(RevenueShare)
class RevenueShareAdmin(admin.ModelAdmin):
    list_display  = ["booking", "total_revenue", "originating_vendor_amt",
                      "platform_amt", "partner_handling_fee"]
    readonly_fields = ["calculated_at"]
