from django.urls import path
from .views import ActivityLogListView, ActivityLogMetaView

urlpatterns = [
    path('', ActivityLogListView.as_view(), name='activity-log-list'),
    path('meta/', ActivityLogMetaView.as_view(), name='activity-log-meta'),
]
