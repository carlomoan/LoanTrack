from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AoMReportViewSet,
    AoMViewSet,
    DomainViewSet,
    DonorContributionViewSet,
    DonorReportViewSet,
    DonorViewSet,
    ExchangeRateViewSet,
    GlobalUserViewSet,
    MFIDisbursementRepaymentViewSet,
    MFIDisbursementViewSet,
    MFIReportViewSet,
    MFIViewSet,
    NotificationsViewSet,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    SystemSettingsView,
)

router = DefaultRouter(trailing_slash=True)

router.register(r"donors", DonorViewSet, basename="donor")
router.register(r"aoms", AoMViewSet, basename="aom")
router.register(r"mfis", MFIViewSet, basename="mfi")
router.register(r"domains", DomainViewSet, basename="domain")
router.register(r"users", GlobalUserViewSet, basename="globaluser")
router.register(r"exchange-rates", ExchangeRateViewSet, basename="exchangerate")
router.register(r"mfi-reports", MFIReportViewSet, basename="mfireport")
router.register(r"aom-reports", AoMReportViewSet, basename="aomreport")
router.register(r"donor-reports", DonorReportViewSet, basename="donorreport")
router.register(
    r"donor-contributions", DonorContributionViewSet, basename="donorcontribution"
)
router.register(r"mfi-disbursements", MFIDisbursementViewSet, basename="mfidisbursement")
router.register(
    r"disbursement-repayments",
    MFIDisbursementRepaymentViewSet,
    basename="disbursementrepayment",
)
router.register(r"notifications", NotificationsViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password-reset-confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("system-settings/", SystemSettingsView.as_view(), name="system-settings"),
]
