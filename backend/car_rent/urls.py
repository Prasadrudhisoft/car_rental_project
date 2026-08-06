"""
URL configuration for car_rent project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/configuration/', include('apps.configuration.urls')),
    path('api/otp/', include('apps.otp.urls')),
    path('api/locations/', include('apps.locations.urls')),
    path('api/vehicles/', include('apps.vehicles.urls')),
    path('api/bookings/', include('apps.bookings.urls')),
    path('api/logistics/', include('apps.logistics.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/promos/', include('apps.promotions.urls')),
    path('api/agreements/', include('apps.agreements.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]

# Serve uploaded media files in development
# In production, your web server (nginx/apache) should serve these directly
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
