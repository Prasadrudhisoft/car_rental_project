from django.db import models
 
 
class City(models.Model):
    """
    A city where the platform operates.
    SQL table: locations_city
    Example rows: Mumbai, Pune, Bengaluru, Delhi
    """
    name       = models.CharField(max_length=100)
    state      = models.CharField(max_length=100)
    is_active  = models.BooleanField(default=True)
    latitude   = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
 
    class Meta:
        db_table = 'locations_city'
        unique_together = ['name', 'state']
        ordering = ['name']
 
    def __str__(self):
        return f'{self.name}, {self.state}'
 
 
class Location(models.Model):
    """
    A specific pickup or dropoff point within a city.
    SQL table: locations_location
    Types: airport, vendor_lot, parking, train_station
    """
    LOCATION_TYPES = [
        ('airport',       'Airport'),
        ('vendor_lot',    'Vendor Lot'),
        ('parking',       'Paid Parking'),
        ('train_station', 'Train Station'),
        ('other',         'Other'),
    ]
 
    city          = models.ForeignKey(City, on_delete=models.CASCADE,
                                      related_name='locations')
    name          = models.CharField(max_length=200)
    location_type = models.CharField(max_length=30, choices=LOCATION_TYPES)
    address       = models.TextField(blank=True)
    latitude      = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active     = models.BooleanField(default=True)
 
    class Meta:
        db_table = 'locations_location'
        ordering = ['city', 'name']
 
    def __str__(self):
        return f'{self.name} ({self.city.name})'
 
 
class CityPairFee(models.Model):
    """
    One-way logistics fee between two cities.
    SQL table: locations_city_pair_fee
    Example: Pune -> Mumbai = INR 800
    Note: direction matters — Pune->Mumbai may cost differently from Mumbai->Pune.
    """
    from_city     = models.ForeignKey(City, on_delete=models.CASCADE,
                                      related_name='outbound_fees')
    to_city       = models.ForeignKey(City, on_delete=models.CASCADE,
                                      related_name='inbound_fees')
    fee           = models.DecimalField(max_digits=8, decimal_places=2)
    is_active     = models.BooleanField(default=True)
 
    class Meta:
        db_table      = 'locations_city_pair_fee'
        unique_together = ['from_city', 'to_city']
 
    def __str__(self):
        return f'{self.from_city} -> {self.to_city}: INR {self.fee}'
