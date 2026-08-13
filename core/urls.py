from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AoMReportViewSet,
    AoMViewSet,
    DomainViewSet,
    DonorReportViewSet,
    DonorViewSet,
    ExchangeRateViewSet,
    GlobalUserViewSet,
    MFIReportViewSet,
    MFIViewSet,
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

urlpatterns = [
    path("", include(router.urls)),
]
