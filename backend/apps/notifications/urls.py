from django.urls import path
from .views import (
    NotificationListView, UnreadCountView, MarkReadView, MarkAllReadView,
    AdminSendNotificationView, AdminSentListView,
)

urlpatterns = [
    path('',                    NotificationListView.as_view(),      name='notification-list'),
    path('unread-count/',       UnreadCountView.as_view(),           name='notification-unread-count'),
    path('<int:pk>/read/',      MarkReadView.as_view(),              name='notification-read'),
    path('mark-all-read/',      MarkAllReadView.as_view(),           name='notification-mark-all-read'),
    path('admin/send/',         AdminSendNotificationView.as_view(), name='admin-notification-send'),
    path('admin/sent/',         AdminSentListView.as_view(),         name='admin-notification-sent'),
]