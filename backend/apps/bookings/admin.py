from django.contrib import admin
from .models import Booking, AddOn, InspectionRecord, InspectionPhoto, Invoice, PaymentEvent, InspectionOTP
 
@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display  = ["booking_ref", "customer", "vehicle", "status",
                      "pickup_date", "return_date", "total_amount", "payment_captured"]
    list_filter   = ["status", "is_one_way", "payment_captured"]
    search_fields = ["customer__email", "vehicle__plate_number"]
    readonly_fields = ["pricing_snapshot", "booking_ref", "created_at"]
 
@admin.register(InspectionRecord)
class InspectionAdmin(admin.ModelAdmin):
    list_display  = ["booking", "inspection_type", "is_locked",
                      "customer_signed", "vendor_signed", "damage_reported"]
 
@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display  = ["invoice_ref", "booking", "total_amount", "created_at"]
 
@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display  = ["booking", "event_type", "razorpay_event_id", "processed_at"]

@admin.register(InspectionOTP)
class InspectionOTPAdmin(admin.ModelAdmin):
    list_display = ['id', 'inspection', 'otp_code', 'created_at', 'expires_at', 'is_used']
    list_filter = ['is_used']