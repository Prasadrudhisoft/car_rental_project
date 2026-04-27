from django.urls import path
from .views import (
    ActiveAgreementView,
    AgreementVersionDetailView,
    RecordAcceptanceView,
    MyAcceptanceHistoryView,
    AdminVersionListCreateView,
    AdminVersionDetailView,
    AdminActivateVersionView,
    AdminAcceptanceListView,
)

urlpatterns = [
    # ── Public / Customer ──────────────────────────────────────────────
    # Fetch the currently active agreement (used in sign modal)
    path('active/',                          ActiveAgreementView.as_view(),          name='agreement-active'),
    # Fetch a specific version by ID (used to display what was signed)
    path('versions/<int:pk>/',               AgreementVersionDetailView.as_view(),   name='agreement-version-detail'),
    # Record user acceptance (called after OTP verify)
    path('accept/',                          RecordAcceptanceView.as_view(),         name='agreement-accept'),
    # Customer's acceptance history
    path('my-history/',                      MyAcceptanceHistoryView.as_view(),      name='agreement-my-history'),

    # ── Admin ──────────────────────────────────────────────────────────
    # List all versions / create new version
    path('admin/versions/',                  AdminVersionListCreateView.as_view(),   name='admin-agreement-versions'),
    # View / edit specific version
    path('admin/versions/<int:pk>/',         AdminVersionDetailView.as_view(),       name='admin-agreement-version-detail'),
    # Activate (publish) a version
    path('admin/versions/<int:pk>/activate/',AdminActivateVersionView.as_view(),     name='admin-agreement-activate'),
    # Full acceptance audit log
    path('admin/acceptances/',               AdminAcceptanceListView.as_view(),      name='admin-agreement-acceptances'),
]