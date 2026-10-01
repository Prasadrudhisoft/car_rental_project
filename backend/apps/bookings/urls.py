from django.urls import path
from .views import (
    PricePreviewView, BookingCreateView, BookingCancelView,
    OneWayFeeView,
    CustomerBookingListView, CustomerBookingDetailView,
    VendorBookingListView, VendorBookingDetailView,
    AdminBookingListView,
    DummyPaymentView,          # ← NEW: replaces Razorpay for dev
    PaymentVerifyView, RazorpayWebhookView,
    InspectionCreateView, InspectionPhotoUploadView, InspectionSignView,
    DamageClaimView, VendorAnalyticsView, AdminAnalyticsView,
    LoyaltyRedemptionView, LoyaltyBalanceView,
    SavePushSubscriptionView, DeletePushSubscriptionView,
)


urlpatterns = [
    # Pricing
    path('price-preview/',                          PricePreviewView.as_view(),           name='price-preview'),
    path('one-way-fee/',                            OneWayFeeView.as_view(),               name='one-way-fee'),

    # Booking lifecycle
    path('create/',                                  BookingCreateView.as_view(),           name='booking-create'),
    path('<int:booking_id>/cancel/',                 BookingCancelView.as_view(),           name='booking-cancel'),

    # ── Payment (dev: dummy; prod: razorpay) ──────────────────────────────
    # Dummy payment — always succeeds, supports advance or full payment
    path('<int:booking_id>/payment/dummy/',          DummyPaymentView.as_view(),            name='payment-dummy'),
    # Keep Razorpay endpoint available for future production use
    path('<int:booking_id>/payment/verify/',         PaymentVerifyView.as_view(),           name='payment-verify'),
    path('webhook/razorpay/',                        RazorpayWebhookView.as_view(),         name='razorpay-webhook'),

    # Inspection
    path('<int:booking_id>/inspect/<str:inspection_type>/',      InspectionCreateView.as_view(),     name='inspect-create'),
    path('<int:booking_id>/inspect/<str:inspection_type>/sign/', InspectionSignView.as_view(),       name='inspect-sign'),
    path('inspections/<int:inspection_id>/photos/',              InspectionPhotoUploadView.as_view(), name='inspect-photo'),
    path('<int:booking_id>/damage-claim/',                        DamageClaimView.as_view(),          name='damage-claim'),

    # Customer
    path('my/',                                      CustomerBookingListView.as_view(),     name='customer-bookings'),
    path('my/<int:pk>/',                             CustomerBookingDetailView.as_view(),   name='customer-booking-detail'),

    # Vendor
    path('vendor/',                                  VendorBookingListView.as_view(),       name='vendor-bookings'),
    path('vendor/<int:pk>/',                         VendorBookingDetailView.as_view(),     name='vendor-booking-detail'),  # ← NEW

    # Admin
    path('admin/',                                   AdminBookingListView.as_view(),        name='admin-bookings'),
    path('loyalty/redeem/',  LoyaltyRedemptionView.as_view(),  name='loyalty-redeem'),
    path('loyalty/balance/', LoyaltyBalanceView.as_view(),     name='loyalty-balance'),
    path('analytics/vendor/', VendorAnalyticsView.as_view(),   name='vendor-analytics'),
    path('analytics/admin/',  AdminAnalyticsView.as_view(),    name='admin-analytics'),
    path('push/subscribe/',   SavePushSubscriptionView.as_view(),   name='push-subscribe'),
    path('push/unsubscribe/', DeletePushSubscriptionView.as_view(), name='push-unsubscribe'),
]