from django.contrib import admin
from .models import Vehicle, VehicleDocument, VehiclePhoto, VehicleAvailability
 
 
@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display   = ["__str__", "vendor", "status", "segment",
                      "city", "daily_rate", "is_certified", "is_blacklisted"]
    list_filter    = ["status", "segment", "fuel_type", "is_certified"]
    search_fields  = ["make", "model", "plate_number", "vehicle_id_code"]
    readonly_fields = ["vehicle_id_code", "qr_code_image", "created_at", "updated_at"]
 
 
@admin.register(VehicleDocument)
class VehicleDocumentAdmin(admin.ModelAdmin):
    list_display   = ["vehicle", "doc_type", "status", "expiry_date", "uploaded_at"]
    list_filter    = ["doc_type", "status"]
 
 
@admin.register(VehiclePhoto)
class VehiclePhotoAdmin(admin.ModelAdmin):
    list_display   = ["vehicle", "angle", "is_cover", "uploaded_at"]
 
 
@admin.register(VehicleAvailability)
class VehicleAvailabilityAdmin(admin.ModelAdmin):
    list_display   = ["vehicle", "blocked_date", "reason"]
    list_filter    = ["reason"]
