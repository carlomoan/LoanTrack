# tenants/views.py

from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from rest_framework import exceptions, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

try:
    from django_filters.rest_framework import DjangoFilterBackend

    DEFAULT_FILTER_BACKENDS = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]
except ImportError:
    DEFAULT_FILTER_BACKENDS = [
        SearchFilter,
        OrderingFilter,
    ]

from .models import (
    Branch,
    District,
    Loan,
    LoanAdjustment,
    LoanDocument,
    LoanOfficer,
    Member,
    Region,
    RepaymentSchedule,
    Street,
    Ward,
)

from .serializers import (
    BranchSerializer,
    DistrictSerializer,
    LoanAdjustmentSerializer,
    LoanDocumentSerializer,
    LoanOfficerSerializer,
    LoanSerializer,
    MemberSerializer,
    RegionSerializer,
    RepaymentScheduleSerializer,
    StreetSerializer,
    WardSerializer,
)

from core.models import (
    AoMReport,
    DonorReport,
    MFIReport,
)

from core.serializers import (
    AoMReportSerializer,
    DonorReportSerializer,
    MFIReportSerializer,
)


TWO_PLACES = Decimal("0.01")


# =============================================================================
# Pagination
# =============================================================================


class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 200


# =============================================================================
# Helpers
# =============================================================================


def safe_float(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def safe_decimal(value):
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0.00")


def parse_period(value):
    """
    Parses YYYY-MM into the first day of the month.

    Example:
        "2026-08" -> date(2026, 8, 1)
    """

    if not value:
        return None

    try:
        parts = str(value).split("-")
        year = int(parts[0])
        month = int(parts[1])
        return date(year, month, 1)
    except Exception:
        return None


def month_label(value):
    if not value:
        return None

    if isinstance(value, datetime):
        value = value.date()

    try:
        return value.strftime("%Y-%m")
    except Exception:
        return None


def add_months(start_date, months):
    month_index = start_date.month - 1 + months
    year = start_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def get_base_currency_from_mfi(mfi):
    donor = getattr(mfi, "donor", None)

    if donor is None:
        aom = getattr(mfi, "aom", None)
        donor = getattr(aom, "donor", None)

    return getattr(donor, "base_currency", None) or "USD"


def build_portfolio_payload():
    loans = Loan.objects.filter(is_deleted=False)

    aggregates = loans.aggregate(
        total_loans=Count("id"),
        total_disbursed=Sum("loan_amount"),
        total_repaid=Sum("repaid_amount"),
        total_outstanding=Sum("outstanding_amount"),
    )

    active_count = loans.filter(status="ACT").count()

    status_breakdown = []
    for row in (
        loans.values("status")
        .annotate(
            count=Count("id"),
            amount=Sum("loan_amount"),
            outstanding=Sum("outstanding_amount"),
        )
        .order_by("status")
    ):
        status_breakdown.append(
            {
                "status": row["status"],
                "count": row["count"],
                "amount": safe_float(row["amount"]),
                "outstanding": safe_float(row["outstanding"]),
            }
        )

    product_breakdown = []
    for row in (
        loans.values("product_type")
        .annotate(
            count=Count("id"),
            amount=Sum("loan_amount"),
            outstanding=Sum("outstanding_amount"),
        )
        .order_by("product_type")
    ):
        product_breakdown.append(
            {
                "product_type": row["product_type"],
                "count": row["count"],
                "amount": safe_float(row["amount"]),
                "outstanding": safe_float(row["outstanding"]),
            }
        )

    gender_distribution = []
    for row in Member.objects.values("gender").annotate(count=Count("id")).order_by("gender"):
        gender_distribution.append(
            {
                "gender": row["gender"],
                "count": row["count"],
            }
        )

    borrower_type_distribution = []
    for row in (
        Member.objects.values("borrower_type")
        .annotate(count=Count("id"))
        .order_by("borrower_type")
    ):
        borrower_type_distribution.append(
            {
                "borrower_type": row["borrower_type"],
                "count": row["count"],
            }
        )

    water_aggregates = loans.filter(water_component=True).aggregate(
        count=Count("id"),
        amount=Sum("loan_amount"),
        outstanding=Sum("outstanding_amount"),
    )

    threshold = timezone.now().date() - timedelta(days=30)
    overdue_schedules = RepaymentSchedule.objects.filter(
        is_paid=False,
        due_date__lte=threshold,
    ).annotate(remaining=F("expected_total") - F("actual_paid"))

    par_aggregates = overdue_schedules.aggregate(
        amount=Sum("remaining"),
    )

    par_count = overdue_schedules.values("loan").distinct().count()

    geographic_breakdown = []
    geo_queryset = (
        loans.annotate(
            region_name=F("member__street__ward__district__region__name"),
            district_name=F("member__street__ward__district__name"),
            ward_name=F("member__street__ward__name"),
        )
        .values("region_name", "district_name", "ward_name")
        .annotate(
            member_count=Count("member", distinct=True),
            loan_count=Count("id", distinct=True),
            total_disbursed=Sum("loan_amount"),
            total_outstanding=Sum("outstanding_amount"),
        )
        .order_by("region_name", "district_name", "ward_name")
    )

    for row in geo_queryset:
        geographic_breakdown.append(
            {
                "street__ward__district__region__name": row["region_name"],
                "street__ward__district__name": row["district_name"],
                "street__ward__name": row["ward_name"],
                "member_count": row["member_count"],
                "loan_count": row["loan_count"],
                "total_disbursed": safe_float(row["total_disbursed"]),
                "total_outstanding": safe_float(row["total_outstanding"]),
            }
        )

    return {
        "portfolio": {
            "total_loans": aggregates["total_loans"] or 0,
            "total_disbursed": safe_float(aggregates["total_disbursed"]),
            "total_repaid": safe_float(aggregates["total_repaid"]),
            "total_outstanding": safe_float(aggregates["total_outstanding"]),
            "active_count": active_count,
        },
        "status_breakdown": status_breakdown,
        "product_breakdown": product_breakdown,
        "gender_distribution": gender_distribution,
        "borrower_type_distribution": borrower_type_distribution,
        "wss_loans": {
            "count": water_aggregates["count"] or 0,
            "amount": safe_float(water_aggregates["amount"]),
            "outstanding": safe_float(water_aggregates["outstanding"]),
        },
        "geographic_breakdown": geographic_breakdown,
        "par_30": {
            "count": par_count,
            "amount": safe_float(par_aggregates["amount"]),
        },
        "generated_at": timezone.now().isoformat(),
    }


def build_monthly_trends_payload():
    disbursements = []
    disbursement_queryset = (
        Loan.objects.filter(is_deleted=False)
        .annotate(month=TruncMonth("disbursement_date"))
        .values("month")
        .annotate(
            count=Count("id"),
            total_amount=Sum("loan_amount"),
        )
        .order_by("month")
    )

    for row in disbursement_queryset:
        disbursements.append(
            {
                "month": month_label(row["month"]),
                "count": row["count"],
                "total_amount": safe_float(row["total_amount"]),
            }
        )

    repayments = []
    repayment_queryset = (
        RepaymentSchedule.objects.filter(paid_date__isnull=False)
        .annotate(month=TruncMonth("paid_date"))
        .values("month")
        .annotate(total_paid=Sum("actual_paid"))
        .order_by("month")
    )

    for row in repayment_queryset:
        repayments.append(
            {
                "month": month_label(row["month"]),
                "total_paid": safe_float(row["total_paid"]),
            }
        )

    return {
        "monthly_disbursements": disbursements,
        "monthly_repayments": repayments,
    }


def get_payload_dict(report):
    if report and isinstance(report.payload, dict):
        return report.payload
    return {}


def aggregate_report_portfolios(reports):
    aggregated = {
        "total_loans": 0,
        "total_disbursed": 0.0,
        "total_repaid": 0.0,
        "total_outstanding": 0.0,
        "active_loans": 0,
        "defaulted_loans": 0,
        "water_loans": 0,
        "male_beneficiaries": 0,
        "female_beneficiaries": 0,
        "regions_served": [],
    }

    for report in reports:
        payload = get_payload_dict(report)
        portfolio = payload.get("portfolio", {})

        aggregated["total_loans"] += int(portfolio.get("total_loans") or 0)
        aggregated["total_disbursed"] += safe_float(portfolio.get("total_disbursed"))
        aggregated["total_repaid"] += safe_float(portfolio.get("total_repaid"))
        aggregated["total_outstanding"] += safe_float(portfolio.get("total_outstanding"))

        status_breakdown = payload.get("status_breakdown", [])
        for row in status_breakdown:
            if row.get("status") == "ACT":
                aggregated["active_loans"] += int(row.get("count") or 0)
            if row.get("status") == "DEF":
                aggregated["defaulted_loans"] += int(row.get("count") or 0)

        wss_loans = payload.get("wss_loans", {})
        aggregated["water_loans"] += int(wss_loans.get("count") or 0)

        for row in payload.get("gender_distribution", []):
            if row.get("gender") == "M":
                aggregated["male_beneficiaries"] += int(row.get("count") or 0)
            if row.get("gender") == "F":
                aggregated["female_beneficiaries"] += int(row.get("count") or 0)

        for row in payload.get("geographic_breakdown", []):
            region = row.get("street__ward__district__region__name")
            if region and region not in aggregated["regions_served"]:
                aggregated["regions_served"].append(region)

    return aggregated


def build_aom_payload(mfi_reports):
    summaries = []

    for report in mfi_reports:
        payload = get_payload_dict(report)
        mfi = report.mfi

        summaries.append(
            {
                "mfi_name": getattr(mfi, "name", ""),
                "mfi_code": getattr(mfi, "code", ""),
                "schema_name": getattr(mfi, "schema_name", ""),
                "local_currency": getattr(mfi, "local_currency", "TZS"),
                "exchange_rate": safe_float(report.exchange_rate),
                "portfolio": payload.get("portfolio", {}),
                "status_breakdown": payload.get("status_breakdown", []),
                "product_breakdown": payload.get("product_breakdown", []),
                "gender_distribution": payload.get("gender_distribution", []),
                "borrower_type_distribution": payload.get("borrower_type_distribution", []),
                "wss_loans": payload.get("wss_loans", {}),
                "geographic_breakdown": payload.get("geographic_breakdown", []),
                "par_30": payload.get("par_30", {}),
            }
        )

    return {
        "total_mfis": len(summaries),
        "mfis": summaries,
        "aggregated": aggregate_report_portfolios(mfi_reports),
    }


def build_donor_payload(aom_reports):
    summaries = []
    total_mfis = 0

    for report in aom_reports:
        payload = get_payload_dict(report)
        aom = report.aom

        total_mfis += int(payload.get("total_mfis") or 0)

        summaries.append(
            {
                "aom_name": getattr(aom, "name", ""),
                "aom_code": getattr(aom, "code", ""),
                "payload": payload,
            }
        )

    aggregated = {
        "total_loans": 0,
        "total_disbursed": 0.0,
        "total_repaid": 0.0,
        "total_outstanding": 0.0,
        "active_loans": 0,
        "defaulted_loans": 0,
        "water_loans": 0,
        "male_beneficiaries": 0,
        "female_beneficiaries": 0,
        "regions_served": [],
    }

    for report in aom_reports:
        payload = get_payload_dict(report)
        report_aggregated = payload.get("aggregated", {})

        aggregated["total_loans"] += int(report_aggregated.get("total_loans") or 0)
        aggregated["total_disbursed"] += safe_float(report_aggregated.get("total_disbursed"))
        aggregated["total_repaid"] += safe_float(report_aggregated.get("total_repaid"))
        aggregated["total_outstanding"] += safe_float(report_aggregated.get("total_outstanding"))
        aggregated["active_loans"] += int(report_aggregated.get("active_loans") or 0)
        aggregated["defaulted_loans"] += int(report_aggregated.get("defaulted_loans") or 0)
        aggregated["water_loans"] += int(report_aggregated.get("water_loans") or 0)
        aggregated["male_beneficiaries"] += int(report_aggregated.get("male_beneficiaries") or 0)
        aggregated["female_beneficiaries"] += int(report_aggregated.get("female_beneficiaries") or 0)

        for region in report_aggregated.get("regions_served", []):
            if region and region not in aggregated["regions_served"]:
                aggregated["regions_served"].append(region)

    return {
        "total_aoms": len(summaries),
        "total_mfis": total_mfis,
        "aoms": summaries,
        "aggregated": aggregated,
    }


# =============================================================================
# Base Tenant Mixin
# =============================================================================


class TenantViewSetMixin:
    """
    Base mixin for tenant schema endpoints.

    These endpoints must not be accessed from the public schema.
    The frontend must send X-Tenant-Subdomain.
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = DEFAULT_FILTER_BACKENDS

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)

        tenant = getattr(request, "tenant", None)
        public_schema = get_public_schema_name()

        if not tenant or getattr(tenant, "schema_name", None) == public_schema:
            raise exceptions.ValidationError(
                {
                    "detail": (
                        "This endpoint requires an MFI tenant context. "
                        "Send the X-Tenant-Subdomain header."
                    )
                }
            )


# =============================================================================
# Geography ViewSets
# =============================================================================


class RegionViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = RegionSerializer

    filterset_fields = ["name", "code"]
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        return Region.objects.annotate(
            district_count=Count("districts", distinct=True)
        ).order_by("name")


class DistrictViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = DistrictSerializer

    filterset_fields = ["region", "name", "code"]
    search_fields = ["name", "code", "region__name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            District.objects.select_related("region")
            .annotate(ward_count=Count("wards", distinct=True))
            .order_by("name")
        )

        region_id = self.request.query_params.get("region")
        if region_id:
            queryset = queryset.filter(region_id=region_id)

        return queryset


class WardViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = WardSerializer

    filterset_fields = ["district", "geo_type", "name", "code"]
    search_fields = ["name", "code", "district__name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            Ward.objects.select_related("district__region")
            .annotate(street_count=Count("streets", distinct=True))
            .order_by("name")
        )

        district_id = self.request.query_params.get("district")
        if district_id:
            queryset = queryset.filter(district_id=district_id)

        return queryset


class StreetViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = StreetSerializer

    filterset_fields = ["ward", "name", "code"]
    search_fields = ["name", "code", "ward__name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            Street.objects.select_related("ward__district__region")
            .annotate(
                member_count=Count("members", distinct=True),
                branch_count=Count("branches", distinct=True),
            )
            .order_by("name")
        )

        ward_id = self.request.query_params.get("ward")
        if ward_id:
            queryset = queryset.filter(ward_id=ward_id)

        return queryset


# =============================================================================
# Branch and Loan Officer ViewSets
# =============================================================================


class BranchViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = BranchSerializer

    filterset_fields = ["is_active", "street"]
    search_fields = ["name", "code", "manager_name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            Branch.objects.select_related("street__ward__district__region")
            .annotate(
                loan_officer_count=Count("loan_officers", distinct=True),
                member_count=Count("members", distinct=True),
                loan_count=Count("loans", distinct=True),
            )
            .order_by("name")
        )


class LoanOfficerViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = LoanOfficerSerializer

    filterset_fields = ["branch", "is_active"]
    search_fields = ["name", "employee_id", "phone", "email"]
    ordering_fields = ["name", "employee_id"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            LoanOfficer.objects.select_related("branch")
            .annotate(
                member_count=Count("members", distinct=True),
                loan_count=Count("loans", distinct=True),
            )
            .order_by("name")
        )


# =============================================================================
# Member ViewSet
# =============================================================================


class MemberViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = MemberSerializer

    filterset_fields = [
        "gender",
        "borrower_type",
        "branch",
        "loan_officer",
        "is_active",
        "street",
        "street__ward",
        "street__ward__district",
        "street__ward__district__region",
    ]

    search_fields = ["member_id", "name", "national_id", "phone"]
    ordering_fields = ["name", "member_id", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            Member.objects.select_related(
                "branch",
                "loan_officer",
                "street__ward__district__region",
            )
            .annotate(
                loan_count=Count("loans", distinct=True),
                total_loan_amount=Sum("loans__loan_amount"),
                total_outstanding=Sum("loans__outstanding_amount"),
            )
            .order_by("name")
        )


# =============================================================================
# Loan ViewSet
# =============================================================================


class LoanViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = LoanSerializer

    filterset_fields = [
        "status",
        "product_type",
        "water_component",
        "branch",
        "loan_officer",
    ]

    search_fields = [
        "loan_number",
        "member__name",
        "member__member_id",
    ]

    ordering_fields = [
        "disbursement_date",
        "loan_amount",
        "created_at",
    ]

    ordering = ["-disbursement_date"]

    def get_queryset(self):
        return (
            Loan.objects.select_related("member", "branch", "loan_officer")
            .filter(is_deleted=False)
            .order_by("-disbursement_date")
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        payload = build_portfolio_payload()
        portfolio = payload.get("portfolio", {})

        return Response(
            {
                "portfolio": {
                    "total_loans": portfolio.get("total_loans", 0),
                    "total_amount": portfolio.get("total_disbursed", 0),
                    "total_disbursed": portfolio.get("total_disbursed", 0),
                    "total_repaid": portfolio.get("total_repaid", 0),
                    "total_outstanding": portfolio.get("total_outstanding", 0),
                    "active_count": portfolio.get("active_count", 0),
                },
                "by_status": payload.get("status_breakdown", []),
                "by_product": payload.get("product_breakdown", []),
                "water_component": payload.get("wss_loans", {}),
            }
        )

    @action(detail=True, methods=["post"], url_path="soft_delete")
    def soft_delete(self, request, pk=None):
        loan = self.get_object()
        loan.is_deleted = True
        loan.deleted_at = timezone.now()
        loan.save(update_fields=["is_deleted", "deleted_at"])

        return Response({"status": "Loan archived successfully."})

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        loan = Loan.objects.filter(pk=pk).first()

        if not loan:
            return Response(
                {"detail": "Loan not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        loan.is_deleted = False
        loan.deleted_at = None
        loan.save(update_fields=["is_deleted", "deleted_at"])

        return Response({"status": "Loan restored successfully."})

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        loan = self.get_object()

        adjustments = (
            LoanAdjustment.objects.select_related("created_by", "approved_by")
            .filter(loan=loan)
            .order_by("-created_at")
        )

        serializer = LoanAdjustmentSerializer(adjustments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="generate_schedule")
    def generate_schedule(self, request, pk=None):
        loan = self.get_object()

        force = str(request.data.get("force", "")).lower() in ["1", "true", "yes"]

        if loan.schedule.exists() and not force:
            return Response(
                {"detail": "Repayment schedule already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if loan.schedule.exists():
            loan.schedule.all().delete()

        loan_amount = safe_decimal(loan.loan_amount)
        interest_rate = safe_decimal(loan.interest_rate)
        term = int(loan.loan_term or 0)

        if term <= 0:
            return Response(
                {"detail": "Loan term must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_date = loan.disbursement_date

        if isinstance(start_date, datetime):
            start_date = start_date.date()

        if not start_date:
            start_date = timezone.now().date()

        total_interest = (
            loan_amount * interest_rate / Decimal("100") * Decimal(term) / Decimal("12")
        ).quantize(TWO_PLACES)

        base_principal = (loan_amount / Decimal(term)).quantize(TWO_PLACES)
        base_interest = (total_interest / Decimal(term)).quantize(TWO_PLACES)

        allocated_principal = Decimal("0.00")
        allocated_interest = Decimal("0.00")

        with transaction.atomic():
            for installment_number in range(1, term + 1):
                if installment_number < term:
                    principal = base_principal
                    interest = base_interest
                else:
                    principal = (loan_amount - allocated_principal).quantize(TWO_PLACES)
                    interest = (total_interest - allocated_interest).quantize(TWO_PLACES)

                allocated_principal += principal
                allocated_interest += interest

                expected_total = (principal + interest).quantize(TWO_PLACES)

                RepaymentSchedule.objects.create(
                    loan=loan,
                    installment_number=installment_number,
                    due_date=add_months(start_date, installment_number),
                    expected_principal=principal,
                    expected_interest=interest,
                    expected_total=expected_total,
                    actual_paid=Decimal("0.00"),
                    is_paid=False,
                    paid_date=None,
                )

        return Response(
            {
                "status": "Repayment schedule generated successfully.",
                "installments": term,
            }
        )


# =============================================================================
# Repayment Schedule ViewSet
# =============================================================================


class RepaymentScheduleViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = RepaymentScheduleSerializer

    filterset_fields = ["loan", "is_paid", "due_date"]
    search_fields = ["loan__loan_number", "loan__member__name"]
    ordering_fields = ["due_date", "installment_number"]
    ordering = ["loan", "installment_number"]

    def get_queryset(self):
        return RepaymentSchedule.objects.select_related("loan__member").all()

    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request):
        today = timezone.now().date()

        queryset = (
            self.get_queryset()
            .filter(is_paid=False, due_date__lt=today)
            .order_by("due_date")
        )

        serializer = self.get_serializer(queryset, many=True)

        return Response(
            {
                "count": queryset.count(),
                "next": None,
                "previous": None,
                "results": serializer.data,
            }
        )

    @action(detail=True, methods=["post"], url_path="record_payment")
    def record_payment(self, request, pk=None):
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except Exception:
            return Response(
                {"detail": "Invalid amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {"detail": "Amount must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            schedule = self.get_queryset().select_for_update().get(pk=pk)
            loan = Loan.objects.select_for_update().get(pk=schedule.loan_id)

            schedule.actual_paid = (
                (schedule.actual_paid or Decimal("0.00")) + amount
            ).quantize(TWO_PLACES)

            if schedule.actual_paid >= schedule.expected_total:
                schedule.is_paid = True
                schedule.paid_date = timezone.now().date()

            schedule.save()

            paid_total = loan.schedule.aggregate(total=Sum("actual_paid"))["total"]
            paid_total = paid_total or Decimal("0.00")

            loan.repaid_amount = paid_total.quantize(TWO_PLACES)

            outstanding = safe_decimal(loan.loan_amount) - loan.repaid_amount
            if outstanding < Decimal("0.00"):
                outstanding = Decimal("0.00")

            loan.outstanding_amount = outstanding.quantize(TWO_PLACES)
            loan.save()

        return Response(self.get_serializer(schedule).data)


# =============================================================================
# Loan Adjustment ViewSet
# =============================================================================


class LoanAdjustmentViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = LoanAdjustmentSerializer

    filterset_fields = ["loan", "adjustment_type", "is_approved"]
    search_fields = ["loan__loan_number", "reference_number", "reason"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return LoanAdjustment.objects.select_related(
            "loan",
            "created_by",
            "approved_by",
        ).all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        with transaction.atomic():
            adjustment = self.get_queryset().select_for_update().get(pk=pk)

            adjustment.is_approved = True
            adjustment.approved_by = request.user
            adjustment.approved_at = timezone.now()
            adjustment.save()

        return Response(self.get_serializer(adjustment).data)


# =============================================================================
# Loan Document ViewSet
# =============================================================================


class LoanDocumentViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    serializer_class = LoanDocumentSerializer

    filterset_fields = ["loan", "document_type"]
    search_fields = ["loan__loan_number", "description"]
    ordering_fields = ["uploaded_at"]
    ordering = ["-uploaded_at"]

    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return LoanDocument.objects.select_related("loan", "uploaded_by").all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


# =============================================================================
# Tenant Report ViewSet
# =============================================================================


class TenantReportViewSet(TenantViewSetMixin, viewsets.ViewSet):

    @action(detail=False, methods=["get"], url_path="portfolio_summary")
    def portfolio_summary(self, request):
        return Response(build_portfolio_payload())

    @action(detail=False, methods=["get"], url_path="monthly_trends")
    def monthly_trends(self, request):
        return Response(build_monthly_trends_payload())

    @action(detail=False, methods=["post"], url_path="generate_mfi_report")
    def generate_mfi_report(self, request):
        tenant = request.tenant
        period = request.data.get("period")
        period_date = parse_period(period)

        if not period_date:
            return Response(
                {"detail": "Valid period is required. Example: 2026-08."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = build_portfolio_payload()

        local_currency = getattr(tenant, "local_currency", None) or "TZS"
        base_currency = get_base_currency_from_mfi(tenant)
        exchange_rate = Decimal("1.000000")

        with schema_context(get_public_schema_name()):
            report, created = MFIReport.objects.update_or_create(
                mfi=tenant,
                period=period_date,
                defaults={
                    "status": "SUBMITTED",
                    "payload": payload,
                    "local_currency": local_currency,
                    "base_currency": base_currency,
                    "exchange_rate": exchange_rate,
                    "generated_by": request.user,
                    "submitted_at": timezone.now(),
                },
            )

        return Response(
            {
                "status": "MFI report generated successfully.",
                "created": created,
                "report_id": report.id,
                "period": period,
            }
        )


# =============================================================================
# Cross-Tenant Report ViewSet
# =============================================================================


class CrossTenantReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="mfi_reports")
    def mfi_reports(self, request):
        with schema_context(get_public_schema_name()):
            queryset = MFIReport.objects.select_related(
                "mfi",
                "mfi__aom",
                "mfi__donor",
            ).order_by("-period")

            mfi_id = request.query_params.get("mfi")
            aom_id = request.query_params.get("aom")
            donor_id = request.query_params.get("donor")
            period = parse_period(request.query_params.get("period"))
            report_status = request.query_params.get("status")

            if mfi_id:
                queryset = queryset.filter(mfi_id=mfi_id)

            if aom_id:
                queryset = queryset.filter(mfi__aom_id=aom_id)

            if donor_id:
                queryset = queryset.filter(mfi__donor_id=donor_id)

            if period:
                queryset = queryset.filter(period=period)

            if report_status:
                queryset = queryset.filter(status=report_status)

            serializer = MFIReportSerializer(queryset, many=True)

            return Response(
                {
                    "count": queryset.count(),
                    "next": None,
                    "previous": None,
                    "results": serializer.data,
                }
            )

    @action(detail=False, methods=["post"], url_path="generate_aom_report")
    def generate_aom_report(self, request):
        aom_id = request.data.get("aom_id")
        period = request.data.get("period")
        period_date = parse_period(period)

        if not aom_id or not period_date:
            return Response(
                {"detail": "aom_id and valid period are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with schema_context(get_public_schema_name()):
            mfi_reports = (
                MFIReport.objects.filter(
                    mfi__aom_id=aom_id,
                    period=period_date,
                )
                .select_related("mfi", "mfi__aom", "mfi__donor")
                .order_by("mfi__name")
            )

            if not mfi_reports.exists():
                return Response(
                    {"detail": "No submitted MFI reports found for this AoM period."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            first_report = mfi_reports.first()
            base_currency = get_base_currency_from_mfi(first_report.mfi)

            payload = build_aom_payload(mfi_reports)

            report, created = AoMReport.objects.update_or_create(
                aom_id=aom_id,
                period=period_date,
                defaults={
                    "status": "GENERATED",
                    "payload": payload,
                    "base_currency": base_currency,
                    "generated_by": request.user,
                },
            )

            return Response(
                {
                    "status": "AoM report generated successfully.",
                    "created": created,
                    "report_id": report.id,
                    "period": period,
                }
            )

    @action(detail=False, methods=["post"], url_path="generate_donor_report")
    def generate_donor_report(self, request):
        donor_id = request.data.get("donor_id")
        period = request.data.get("period")
        period_date = parse_period(period)

        if not donor_id or not period_date:
            return Response(
                {"detail": "donor_id and valid period are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with schema_context(get_public_schema_name()):
            aom_reports = (
                AoMReport.objects.filter(
                    aom__donor_id=donor_id,
                    period=period_date,
                )
                .select_related("aom", "aom__donor")
                .order_by("aom__name")
            )

            if not aom_reports.exists():
                return Response(
                    {"detail": "No generated AoM reports found for this donor period."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            first_report = aom_reports.first()
            donor = getattr(first_report.aom, "donor", None)
            base_currency = getattr(donor, "base_currency", None) or "USD"

            payload = build_donor_payload(aom_reports)

            report, created = DonorReport.objects.update_or_create(
                donor_id=donor_id,
                period=period_date,
                defaults={
                    "status": "GENERATED",
                    "payload": payload,
                    "base_currency": base_currency,
                    "generated_by": request.user,
                },
            )

            return Response(
                {
                    "status": "Donor report generated successfully.",
                    "created": created,
                    "report_id": report.id,
                    "period": period,
                }
            )

    @action(detail=False, methods=["get"], url_path="cached_report")
    def cached_report(self, request):
        report_type = str(request.query_params.get("type", "mfi")).lower()
        entity_id = request.query_params.get("entity_id")
        period = parse_period(request.query_params.get("period"))

        if report_type not in ["mfi", "aom", "donor"]:
            return Response(
                {"detail": "type must be one of: mfi, aom, donor."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not entity_id or not period:
            return Response(
                {"detail": "entity_id and valid period are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            entity_id = int(entity_id)
        except Exception:
            return Response(
                {"detail": "entity_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"{report_type}_report_{entity_id}_{period.isoformat()}"
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(
                {
                    "cached": True,
                    "data": cached_data,
                }
            )

        with schema_context(get_public_schema_name()):
            report = None
            serializer_class = None

            if report_type == "mfi":
                report = MFIReport.objects.filter(
                    mfi_id=entity_id,
                    period=period,
                ).first()
                serializer_class = MFIReportSerializer

            elif report_type == "aom":
                report = AoMReport.objects.filter(
                    aom_id=entity_id,
                    period=period,
                ).first()
                serializer_class = AoMReportSerializer

            elif report_type == "donor":
                report = DonorReport.objects.filter(
                    donor_id=entity_id,
                    period=period,
                ).first()
                serializer_class = DonorReportSerializer

            if not report or not serializer_class:
                return Response(
                    {
                        "cached": False,
                        "data": None,
                    }
                )

            data = serializer_class(report).data
            cache.set(cache_key, data, 60 * 5)

            return Response(
                {
                    "cached": False,
                    "data": data,
                }
            )
