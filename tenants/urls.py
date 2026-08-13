from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BranchViewSet,
    CrossTenantReportViewSet,
    DistrictViewSet,
    LoanAdjustmentViewSet,
    LoanDocumentViewSet,
    LoanOfficerViewSet,
    LoanViewSet,
    MemberViewSet,
    RegionViewSet,
    RepaymentScheduleViewSet,
    StreetViewSet,
    TenantReportViewSet,
    WardViewSet,
)

router = DefaultRouter(trailing_slash=True)

router.register(r"regions", RegionViewSet, basename="region")
router.register(r"districts", DistrictViewSet, basename="district")
router.register(r"wards", WardViewSet, basename="ward")
router.register(r"streets", StreetViewSet, basename="street")

router.register(r"branches", BranchViewSet, basename="branch")
router.register(r"loan-officers", LoanOfficerViewSet, basename="loanofficer")
router.register(r"members", MemberViewSet, basename="member")
router.register(r"loans", LoanViewSet, basename="loan")

router.register(
    r"repayment-schedules",
    RepaymentScheduleViewSet,
    basename="repaymentschedule",
)

router.register(
    r"loan-adjustments",
    LoanAdjustmentViewSet,
    basename="loanadjustment",
)

router.register(
    r"loan-documents",
    LoanDocumentViewSet,
    basename="loandocument",
)

router.register(r"reports", TenantReportViewSet, basename="report")


# Cross-tenant/public reporting endpoints
cross_router = DefaultRouter(trailing_slash=True)

cross_router.register(
    r"cross-tenant",
    CrossTenantReportViewSet,
    basename="cross-tenant",
)

urlpatterns = [
    path("", include(router.urls)),
    path("public/", include(cross_router.urls)),
]
