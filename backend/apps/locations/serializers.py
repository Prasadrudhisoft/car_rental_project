# from rest_framework import serializers
# from .models import City, Location, CityPairFee
 
 
# class CitySerializer(serializers.ModelSerializer):
#     class Meta:
#         model  = City
#         fields = ['id','name','state','is_active','latitude','longitude']
 
 
# class LocationSerializer(serializers.ModelSerializer):
#     city_name = serializers.CharField(source='city.name', read_only=True)
 
#     class Meta:
#         model  = Location
#         fields = ['id','city','city_name','name','location_type',
#                   'address','latitude','longitude','is_active']
 
 
# class CityPairFeeSerializer(serializers.ModelSerializer):
#     from_city_name = serializers.CharField(source='from_city.name', read_only=True)
#     to_city_name   = serializers.CharField(source='to_city.name',   read_only=True)
 
#     class Meta:
#         model  = CityPairFee
#         fields = ['id','from_city','from_city_name','to_city','to_city_name',
#                   'fee','is_active']


# # locations/serializers.py (ADD THIS FILE if not present)
from rest_framework import serializers
from .models import City, Location, CityPairFee

class LocationSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    class Meta:
        model = Location
        fields = ['id', 'name', 'location_type', 'address', 'latitude', 'longitude',
                  'city', 'city_name', 'is_active']

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'state', 'latitude', 'longitude', 'is_active']

class CityPairFeeSerializer(serializers.ModelSerializer):
    from_city_name = serializers.CharField(source='from_city.name', read_only=True)
    to_city_name = serializers.CharField(source='to_city.name', read_only=True)
    class Meta:
        model = CityPairFee
        fields = ['id', 'from_city', 'from_city_name', 'to_city', 'to_city_name',
                  'fee', 'is_active']