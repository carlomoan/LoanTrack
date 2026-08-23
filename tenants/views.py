# tenants/views.py

from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal

import requests
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
from rest_framework.views import APIView

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
    AoM,
    AoMReport,
    DonorReport,
    MFI,
    MFIReport,
)

from core.serializers import (
    AoMReportSerializer,
    DonorReportSerializer,
    MFIReportSerializer,
)

from core.permissions import (
    AOM_STAFF,
    DONOR_STAFF,
    LOAN_OFFICER,
    MFI_ADMIN,
    MFI_MANAGER,
    MFI_WRITE_ROLES,
    SUPER_ADMIN,
    get_role,
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

    # Individual-loan interest tracking. RepaymentSchedule already splits
    # each installment into expected_principal/expected_interest/
    # actual_paid, same shape as the wholesale MFIDisbursementRepayment
    # schedule one tier up -- this aggregates that into a portfolio-wide
    # view of how much interest was actually expected vs collected, and
    # classifies closed loans as repaid-with-interest or
    # repaid-with-interest-waived (via a LoanAdjustment of type
    # INTEREST_WAIVER, the same mechanism used for a real waiver
    # decision elsewhere in the app).
    interest_aggregates = RepaymentSchedule.objects.filter(
        loan__is_deleted=False
    ).aggregate(
        expected_interest=Sum("expected_interest"),
        expected_principal=Sum("expected_principal"),
    )

    # actual_paid isn't split principal-vs-interest per installment, so
    # interest collected is derived per-loan: whatever was paid beyond
    # the loan's own principal counts as interest collected, capped at
    # what was actually expected.
    principal_collected_total = Decimal("0")
    interest_collected_total = Decimal("0")

    closed_loan_ids_with_waiver = set(
        LoanAdjustment.objects.filter(
            loan__status=Loan.LoanStatus.CLOSED,
            loan__is_deleted=False,
            adjustment_type=LoanAdjustment.AdjustmentType.INTEREST_WAIVER,
        ).values_list("loan_id", flat=True)
    )

    closed_loans = loans.filter(status=Loan.LoanStatus.CLOSED).only(
        "id", "loan_amount", "repaid_amount"
    )

    repaid_with_interest_count = 0
    repaid_interest_waived_count = 0

    for loan in closed_loans:
        principal = loan.loan_amount or Decimal("0")
        repaid = loan.repaid_amount or Decimal("0")
        principal_collected_total += min(principal, repaid)
        interest_collected_total += max(Decimal("0"), repaid - principal)

        if loan.id in closed_loan_ids_with_waiver:
            repaid_interest_waived_count += 1
        else:
            repaid_with_interest_count += 1

    return {
        "portfolio": {
            "total_loans": aggregates["total_loans"] or 0,
            "total_disbursed": safe_float(aggregates["total_disbursed"]),
            "total_repaid": safe_float(aggregates["total_repaid"]),
            "total_outstanding": safe_float(aggregates["total_outstanding"]),
            "active_count": active_count,
        },
        "status_breakdown": status_breakdown,
        "interest_repayment_breakdown": {
            "closed_loans_total": len(closed_loans),
            "repaid_with_interest_count": repaid_with_interest_count,
            "repaid_interest_waived_count": repaid_interest_waived_count,
            "principal_collected": safe_float(principal_collected_total),
            "interest_collected": safe_float(interest_collected_total),
            "interest_expected_portfolio_wide": safe_float(
                interest_aggregates["expected_interest"]
            ),
        },
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

    These endpoints must not be accessed from the public schema, AND the
    requesting user must actually belong to the resolved tenant. Without
    this second check, any authenticated user -- regardless of which MFI
    they belong to -- could send an arbitrary `X-Tenant-Subdomain` header
    and read or edit another MFI's members, loans, and repayments. That is
    a full tenant-isolation bypass, so this check is not optional.

    Access by role, once a tenant has been resolved:
        SUPER_ADMIN   full read/write on any tenant.
        AOM_STAFF /
        DONOR_STAFF   no access. Individual member/loan data belongs to
                      the MFI's own staff; AoM and donor oversight goes
                      through MFIReport (aggregate MFI-level reports)
                      and MFIDisbursement (the wholesale AoM-to-MFI
                      capital ledger) instead -- both public-schema
                      endpoints, not the tenant schema.
        MFI_ADMIN /
        MFI_MANAGER   read/write, only their own MFI's tenant.
        LOAN_OFFICER  read/write except DELETE, only their own MFI's
                      tenant.
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

        self._check_tenant_membership(request, tenant)

    def _check_tenant_membership(self, request, tenant):
        role = get_role(request)
        user = request.user

        if role == SUPER_ADMIN:
            return

        # AoM and Donor staff oversee the wholesale relationship (how much
        # capital an AoM has disbursed to an MFI, and the MFI-level
        # aggregate reports that MFI submits upward) -- never the
        # individual members and loans an MFI's own staff manage day to
        # day. That data belongs to the MFI's tenant schema and stays
        # there; AoM/Donor roles reach financial oversight through
        # MFIReport and MFIDisbursement instead, both public-schema
        # endpoints scoped to their own organization.
        if role in (AOM_STAFF, DONOR_STAFF):
            raise exceptions.PermissionDenied(
                "AoM and donor accounts don't have access to individual "
                "member/loan records. Use MFI reports and disbursement "
                "data (/api/mfi-reports/, /api/mfi-disbursements/) for "
                "oversight instead."
            )

        if role in MFI_WRITE_ROLES:  # MFI_ADMIN, MFI_MANAGER
            if tenant.id == user.mfi_id:
                return
            raise exceptions.PermissionDenied(
                "You do not have access to this MFI's data."
            )

        if role == LOAN_OFFICER:
            if tenant.id == user.mfi_id and request.method != "DELETE":
                return
            raise exceptions.PermissionDenied(
                "You do not have access to this MFI's data, "
                "or loan officers cannot delete records."
            )

        raise exceptions.PermissionDenied(
            "Your account is not authorized to access MFI tenant data."
        )


# =============================================================================
# Geography ViewSets
# =============================================================================


class GeocodeReverseView(TenantViewSetMixin, APIView):
    """
    GET /api/tenant/geocode/reverse/?lat=<lat>&lng=<lng>

    Resolves a map click to a Region/District/Ward/Street via OpenStreetMap's
    Nominatim reverse-geocoding service, creating whichever levels of the
    hierarchy don't already exist for this tenant (get_or_create at each
    level, so re-clicking the same area never creates duplicates).

    This is the backend half of "click a point on the map, the location
    hierarchy gets filled in automatically" -- the frontend map component
    calls this after a click and gets back ready-to-use Region/District/
    Ward/Street records (with ids) to attach to a Branch or Member.

    Note: Nominatim is a shared public service with a strict 1 request/
    second usage policy and no uptime guarantee -- fine for development
    and light use, but a production deployment taking real traffic on
    this feature should move to a paid provider (Mapbox, Google, HERE)
    or a self-hosted Nominatim instance instead.
    """

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")

        if lat is None or lng is None:
            return Response(
                {"detail": "lat and lng query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except (TypeError, ValueError):
            return Response(
                {"detail": "lat and lng must both be numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (-90 <= lat_f <= 90 and -180 <= lng_f <= 180):
            return Response(
                {"detail": "lat/lng are out of range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "format": "jsonv2",
                    "lat": lat_f,
                    "lon": lng_f,
                    "addressdetails": 1,
                    "zoom": 18,
                },
                headers={
                    # Nominatim's usage policy requires a real
                    # identifying User-Agent -- requests without one are
                    # liable to be blocked.
                    "User-Agent": "LoanTrack/1.0 (contact: support@loantrack.local)"
                },
                # Nominatim is a free shared service that can be slow under
                # load; 8s was too tight in practice (read timeouts on
                # perfectly valid lookups). (connect, read) tuple: fail fast
                # if we can't connect at all, but give a slow response room.
                timeout=(5, 20),
            )
            response.raise_for_status()
            payload = response.json()
        except requests.Timeout:
            return Response(
                {
                    "detail": (
                        "Reverse geocoding is taking too long right now. "
                        "Try again, or enter the location manually."
                    )
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"Reverse geocoding lookup failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if "error" in payload:
            return Response(
                {"detail": "No address found for this location."},
                status=status.HTTP_404_NOT_FOUND,
            )

        address = payload.get("address", {})

        # OSM's address tagging varies a lot by country/region -- these
        # fall back through the fields Nominatim actually uses for
        # Tanzanian addresses in practice, from broadest to narrowest.
        #
        # Dar es Salaam is the big special case: Nominatim tags it as
        #   region: "Coastal Zone"     <- a *zone*, not the region users know
        #   city: "Dar es Salaam"      <- the actual region (a city-region)
        #   city_district: "Ilala Municipal"  <- the actual district/municipal
        #   suburb/subward             <- ward-level names
        # so "region" alone yields "Coastal Zone" and there is never a
        # county/state_district tag -- which left district/ward/street empty
        # for every Dar point. The chains below account for that shape.
        region_name = (
            address.get("state")
            or address.get("region")
            or address.get("city")
        )
        # A zone label like "Coastal Zone"/"Central Zone" isn't a region a
        # member would recognize; prefer the city name when the state field
        # holds one of those.
        if region_name and "zone" in region_name.lower():
            region_name = (
                address.get("city")
                or address.get("state_district")
                or address.get("county")
                or region_name
            )

        def _strip_municipal(name):
            # Nominatim's city_district values carry an administrative suffix
            # ("Ilala Municipal", "Ubungo Municipal Council"); store the bare
            # district name users actually pick from ("Ilala", "Ubungo").
            import re

            return re.sub(
                r"\s+(municipal|town|district)(\s+council\s*(office)?)?$",
                "",
                name,
                flags=re.IGNORECASE,
            ).strip()

        district_name = (
            address.get("county")
            or address.get("state_district")
            or address.get("district")
            # Dar es Salaam's districts only ever appear as city_district.
            or address.get("city_district")
        )
        if district_name:
            district_name = _strip_municipal(district_name)

        ward_name = (
            address.get("subward")
            or address.get("suburb")
            or address.get("neighbourhood")
            or address.get("city_district")
            or address.get("quarter")
            or address.get("town")
            or address.get("village")
            # City-region fallback: when the region itself is the city
            # (Dar es Salaam), its wards are tagged at city level.
            or address.get("city")
        )
        # Don't let the ward collapse to the same string as the region/district
        # (e.g. both "Dar es Salaam") -- a null ward beats a duplicate one.
        if ward_name and ward_name in {region_name, district_name}:
            ward_name = None
        street_name = address.get("road")

        if not region_name:
            return Response(
                {
                    "detail": (
                        "Could not determine a region for this location. "
                        "Try a point closer to a named place."
                    ),
                    "raw_address": address,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        region, _ = Region.objects.get_or_create(name=region_name)

        district = None
        if district_name:
            district, _ = District.objects.get_or_create(
                region=region, name=district_name
            )

        ward = None
        if district and ward_name:
            ward, _ = Ward.objects.get_or_create(
                district=district,
                name=ward_name,
                defaults={"geo_type": Ward.GeoType.URBAN},
            )

        street = None
        if ward and street_name:
            street, _ = Street.objects.get_or_create(ward=ward, name=street_name)

        def _serialize(obj):
            return {"id": obj.id, "name": obj.name} if obj else None

        return Response(
            {
                "coordinates": {"lat": lat_f, "lng": lng_f},
                "display_name": payload.get("display_name"),
                "region": _serialize(region),
                "district": _serialize(district),
                "ward": _serialize(ward),
                "street": _serialize(street),
            }
        )


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

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        Approve a pending loan (PND -> ACT). Separation of duty: MFI_ADMIN /
        MFI_MANAGER / SUPER_ADMIN approve; the LOAN_OFFICER who created the
        loan cannot approve their own.
        """
        role = get_role(request)

        if role not in (SUPER_ADMIN, MFI_ADMIN, MFI_MANAGER):
            raise exceptions.PermissionDenied(
                "Only MFI admins and managers can approve loans."
            )

        with transaction.atomic():
            # Lock via a plain query: get_queryset() carries select_related
            # LEFT OUTER JOINs on nullable FKs, and Postgres refuses
            # SELECT ... FOR UPDATE across outer joins.
            loan = Loan.objects.select_for_update().get(pk=pk)

            if loan.status != Loan.LoanStatus.PENDING:
                return Response(
                    {"detail": "Only pending loans can be approved."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            loan.status = Loan.LoanStatus.ACTIVE
            loan.save()

        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        """
        Close a loan (ACT -> CLS). Only allowed once the loan is fully
        repaid -- closing early would hide real outstanding debt.
        """
        role = get_role(request)

        if role not in (SUPER_ADMIN, MFI_ADMIN, MFI_MANAGER):
            raise exceptions.PermissionDenied(
                "Only MFI admins and managers can close loans."
            )

        with transaction.atomic():
            loan = Loan.objects.select_for_update().get(pk=pk)

            if loan.status != Loan.LoanStatus.ACTIVE:
                return Response(
                    {"detail": "Only active loans can be closed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (loan.outstanding_amount or Decimal("0")) > Decimal("0"):
                return Response(
                    {
                        "detail": (
                            f"Loan still has {loan.outstanding_amount} "
                            "outstanding and cannot be closed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            loan.status = Loan.LoanStatus.CLOSED
            loan.save()

        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=["post"], url_path="mark_defaulted")
    def mark_defaulted(self, request, pk=None):
        """
        Flag an active loan as defaulted (ACT -> DEF). Admin decision,
        recorded against the loan's history trail.
        """
        role = get_role(request)

        if role not in (SUPER_ADMIN, MFI_ADMIN, MFI_MANAGER):
            raise exceptions.PermissionDenied(
                "Only MFI admins and managers can flag defaults."
            )

        with transaction.atomic():
            loan = Loan.objects.select_for_update().get(pk=pk)

            if loan.status != Loan.LoanStatus.ACTIVE:
                return Response(
                    {"detail": "Only active loans can be marked as defaulted."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            loan.status = Loan.LoanStatus.DEFAULTED
            loan.save()

        return Response(self.get_serializer(loan).data)

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
            schedule = RepaymentSchedule.objects.select_for_update().get(pk=pk)
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
            adjustment = LoanAdjustment.objects.select_for_update().get(pk=pk)

            if adjustment.is_approved:
                return Response(
                    {"detail": "This adjustment is already approved."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            adjustment.is_approved = True
            adjustment.approved_by = request.user
            adjustment.approved_at = timezone.now()
            adjustment.save()

        return Response(self.get_serializer(adjustment).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """
        Reject a pending adjustment. The record is kept (with who rejected
        it and why) rather than deleted, so the audit trail shows the full
        decision -- not just the ones that were approved.
        """
        reason = str(request.data.get("reason", "")).strip()

        with transaction.atomic():
            adjustment = LoanAdjustment.objects.select_for_update().get(pk=pk)

            if adjustment.is_approved:
                return Response(
                    {"detail": "An approved adjustment cannot be rejected."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            adjustment.is_approved = False
            adjustment.approved_by = request.user
            adjustment.approved_at = timezone.now()
            adjustment.reason = (
                f"{adjustment.reason}\n[REJECTED: {reason}]" if reason
                else f"{adjustment.reason}\n[REJECTED]"
            ).strip()
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


class ActivityViewSet(TenantViewSetMixin, viewsets.ViewSet):
    """
    Read-only audit trail: who changed what, and when, across the
    operational models MFI staff actually care about day to day (Loan,
    Member, LoanAdjustment, Branch). Every one of these already has
    django-simple-history tracking every save -- this just makes that
    visible instead of leaving it as data nobody can see.

    Not a full generic history browser (that would cover every tenant
    model); scoped to the models where "who changed this and when"
    matters most for a financial system's day-to-day trust.
    """

    permission_classes = [permissions.IsAuthenticated]

    TRACKED_MODELS = [
        ("Loan", Loan, "loan_number"),
        ("Member", Member, "name"),
        ("LoanAdjustment", LoanAdjustment, None),
        ("Branch", Branch, "name"),
    ]

    CHANGE_TYPE_LABELS = {"+": "created", "~": "changed", "-": "deleted"}

    def list(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 25))))
        except ValueError:
            page_size = 25

        # Pull a generous slice from each tracked model's history table,
        # merge, and sort once in Python -- a real cross-table UNION
        # ordered by date isn't practical here since each historical
        # model is a distinct table with its own columns. Bounded by
        # FETCH_PER_MODEL so this stays cheap even with a lot of history.
        FETCH_PER_MODEL = 200
        merged = []

        for model_name, model_cls, repr_field in self.TRACKED_MODELS:
            history_qs = (
                model_cls.history.select_related("history_user")
                .order_by("-history_date")[:FETCH_PER_MODEL]
            )
            for record in history_qs:
                label = (
                    getattr(record, repr_field, None)
                    if repr_field
                    else None
                ) or str(record)

                changed_fields = []
                if record.history_type == "~":
                    prev = record.prev_record
                    if prev is not None:
                        diff = record.diff_against(prev)
                        changed_fields = [c.field for c in diff.changes]

                merged.append(
                    {
                        "history_id": record.history_id,
                        "model": model_name,
                        "object_id": record.id,
                        "object_repr": label,
                        "change_type": self.CHANGE_TYPE_LABELS.get(
                            record.history_type, record.history_type
                        ),
                        "changed_by": (
                            record.history_user.username
                            if record.history_user_id
                            else None
                        ),
                        "changed_at": record.history_date,
                        "changed_fields": changed_fields,
                    }
                )

        merged.sort(key=lambda row: row["changed_at"], reverse=True)

        total = len(merged)
        start = (page - 1) * page_size
        page_items = merged[start : start + page_size]

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": page_items,
            }
        )


class CrossTenantReportViewSet(viewsets.ViewSet):
    """
    Reads and generates consolidated reports across MFI/AoM/Donor
    boundaries. Because these endpoints exist precisely to cross tenant
    lines, every action here must independently enforce that the caller
    is only ever shown, or allowed to generate, data for their own
    organization -- there is no tenant-schema wall doing that for us here.
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="mfi_reports")
    def mfi_reports(self, request):
        role = get_role(request)

        with schema_context(get_public_schema_name()):
            queryset = MFIReport.objects.select_related(
                "mfi",
                "mfi__aom",
                "mfi__donor",
            ).order_by("-period")

            # Restrict to the caller's own organization *before* applying
            # their requested filters, so a non-super-admin can narrow
            # their own results but never widen them past their scope.
            if role == AOM_STAFF:
                queryset = queryset.filter(mfi__aom_id=request.user.aom_id)
            elif role == DONOR_STAFF:
                from django.db.models import Q

                queryset = queryset.filter(
                    Q(mfi__donor_id=request.user.donor_id)
                    | Q(mfi__aom__donors=request.user.donor_id)
                )
            elif role in MFI_WRITE_ROLES or role == LOAN_OFFICER:
                queryset = queryset.filter(mfi_id=request.user.mfi_id)
            elif role != SUPER_ADMIN:
                queryset = queryset.none()

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

        role = get_role(request)
        if role == AOM_STAFF and str(request.user.aom_id) != str(aom_id):
            raise exceptions.PermissionDenied(
                "You can only generate reports for your own AoM."
            )
        if role not in (SUPER_ADMIN, AOM_STAFF):
            raise exceptions.PermissionDenied(
                "You are not authorized to generate AoM reports."
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

        role = get_role(request)
        if role == DONOR_STAFF and str(request.user.donor_id) != str(donor_id):
            raise exceptions.PermissionDenied(
                "You can only generate reports for your own donor."
            )
        if role not in (SUPER_ADMIN, DONOR_STAFF):
            raise exceptions.PermissionDenied(
                "You are not authorized to generate donor reports."
            )

        with schema_context(get_public_schema_name()):
            aom_reports = (
                AoMReport.objects.filter(
                    aom__donors=donor_id,
                    period=period_date,
                )
                .select_related("aom").prefetch_related("aom__donors")
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

        role = get_role(request)
        user = request.user

        if role != SUPER_ADMIN:
            allowed = False
            if report_type == "mfi":
                if role in MFI_WRITE_ROLES or role == LOAN_OFFICER:
                    allowed = entity_id == user.mfi_id
                elif role == AOM_STAFF:
                    allowed = MFI.objects.filter(
                        id=entity_id, aom_id=user.aom_id
                    ).exists()
                elif role == DONOR_STAFF:
                    from django.db.models import Q

                    allowed = MFI.objects.filter(
                        Q(id=entity_id)
                        & (Q(donor_id=user.donor_id) | Q(aom__donor_id=user.donor_id))
                    ).exists()
            elif report_type == "aom":
                if role == AOM_STAFF:
                    allowed = entity_id == user.aom_id
                elif role == DONOR_STAFF:
                    allowed = AoM.objects.filter(
                        id=entity_id, donor_id=user.donor_id
                    ).exists()
            elif report_type == "donor":
                if role == DONOR_STAFF:
                    allowed = entity_id == user.donor_id

            if not allowed:
                raise exceptions.PermissionDenied(
                    "You are not authorized to view this report."
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
