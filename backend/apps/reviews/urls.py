from django.urls import path
from .views import (SubmitReviewView, VendorReviewListView,
                     VehicleReviewListView, PendingReviewView)
 
urlpatterns = [
    path('submit/',                          SubmitReviewView.as_view(),       name='review-submit'),
    path('pending/',                         PendingReviewView.as_view(),      name='review-pending'),
    path('vendor/<int:vendor_id>/',          VendorReviewListView.as_view(),   name='vendor-reviews'),
    path('vehicle/<int:vehicle_id>/',        VehicleReviewListView.as_view(),  name='vehicle-reviews'),
]
