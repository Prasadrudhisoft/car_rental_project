from django.contrib import admin
from .models import City, Location, CityPairFee


# -------------------- INLINES --------------------

class LocationInline(admin.TabularInline):
    model = Location
    extra = 0


# -------------------- CITY --------------------

@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'state',
        'is_active', 'latitude', 'longitude'
    )

    list_filter = ('state', 'is_active')
    search_fields = ('name', 'state')
    ordering = ('name',)

    inlines = [LocationInline]


# -------------------- LOCATION --------------------

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'city',
        'location_type', 'is_active'
    )

    list_filter = ('location_type', 'is_active', 'city')
    search_fields = ('name', 'city__name', 'address')
    ordering = ('city', 'name')


# -------------------- CITY PAIR FEE --------------------

@admin.register(CityPairFee)
class CityPairFeeAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'from_city', 'to_city',
        'fee', 'is_active'
    )

    list_filter = ('is_active', 'from_city', 'to_city')
    search_fields = (
        'from_city__name',
        'to_city__name'
    )

    ordering = ('from_city', 'to_city')