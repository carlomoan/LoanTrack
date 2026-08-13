import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation

from celery import shared_task
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django_tenants.utils import schema_context

from tenants.models import (
    Branch,
    District,
    Loan,
    LoanOfficer,
    Member,
    Region,
    RepaymentSchedule,
    Street,
    Ward,
)


# =============================================================================
# Report Tasks
# =============================================================================


@shared_task(bind=True, max_retries=3)
def generate_monthly_mfi_report(self, mfi_schema_name):
    """
    Generate monthly consolidated report for an MFI.

    Runs in the background via Celery.
    Caches result in Redis for fast dashboard loading.
    """

    try:
        with schema_context(mfi_schema_name):
            loans = Loan.objects.all()
            members = Member.objects.all()
            branches = Branch.objects.all()
            officers = LoanOfficer.objects.all()

            portfolio = loans.aggregate(
                total_loans=Count("id"),
                total_disbursed=Sum("loan_amount"),
                total_repaid=Sum("repaid_amount"),
                total_outstanding=Sum("outstanding_amount"),
            )

            status_breakdown = list(
                loans.values("status").annotate(
                    count=Count("id"),
                    amount=Sum("loan_amount"),
                    outstanding=Sum("outstanding_amount"),
                )
            )

            product_breakdown = list(
                loans.values("product_type")
                .annotate(
                    count=Count("id"),
                    amount=Sum("loan_amount"),
                    outstanding=Sum("outstanding_amount"),
                )
                .order_by("-amount")
            )

            branch_performance = list(
                branches.annotate(
                    loan_count=Count("loans", distinct=True),
                    total_disbursed=Sum("loans__loan_amount"),
                    total_outstanding=Sum("loans__outstanding_amount"),
                    member_count=Count("members", distinct=True),
                ).values(
                    "name",
                    "loan_count",
                    "total_disbursed",
                    "total_outstanding",
                    "member_count",
                )
            )

            officer_performance = list(
                officers.annotate(
                    loan_count=Count("loans", distinct=True),
                    total_disbursed=Sum("loans__loan_amount"),
                    total_outstanding=Sum("loans__outstanding_amount"),
                    member_count=Count("members", distinct=True),
                ).values(
                    "name",
                    "loan_count",
                    "total_disbursed",
                    "total_outstanding",
                    "member_count",
                )
            )

            geographic_breakdown = list(
                members.filter(street__isnull=False)
                .values(
                    "street__ward__district__region__name",
                    "street__ward__district__name",
                    "street__ward__name",
                )
                .annotate(
                    member_count=Count("id"),
                    loan_count=Count("loans"),
                    total_disbursed=Sum("loans__loan_amount"),
                    total_outstanding=Sum("loans__outstanding_amount"),
                )
                .order_by("-total_disbursed")
            )

            wss_loans = loans.filter(water_component=True).aggregate(
                count=Count("id"),
                total_disbursed=Sum("loan_amount"),
                total_outstanding=Sum("outstanding_amount"),
            )

            monthly_disbursements = list(
                loans.annotate(month=TruncMonth("disbursement_date"))
                .values("month")
                .annotate(
                    count=Count("id"),
                    total_amount=Sum("loan_amount"),
                )
                .order_by("month")
            )

            report_data = {
                "mfi_schema": mfi_schema_name,
                "portfolio": portfolio,
                "status_breakdown": status_breakdown,
                "product_breakdown": product_breakdown,
                "branch_performance": branch_performance,
                "officer_performance": officer_performance,
                "geographic_breakdown": geographic_breakdown,
                "wss_loans": wss_loans,
                "monthly_disbursements": monthly_disbursements,
                "generated_at": timezone.now().isoformat(),
            }

            cache_key = f"monthly_report_{mfi_schema_name}"
            cache.set(cache_key, report_data, timeout=3600)

            return report_data

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3)
def generate_cross_tenant_report(self, aom_id=None, donor_id=None):
    """
    Generate consolidated report across multiple MFIs for AoM/Donor dashboards.
    """

    from core.models import MFI

    try:
        mfis = MFI.objects.filter(is_active=True)

        if aom_id:
            mfis = mfis.filter(aom_id=aom_id)

        if donor_id:
            mfis = mfis.filter(donor_id=donor_id)

        consolidated = {
            "total_mfis": mfis.count(),
            "mfis": [],
            "aggregated": {
                "total_loans": 0,
                "total_disbursed": 0,
                "total_repaid": 0,
                "total_outstanding": 0,
                "active_loans": 0,
                "defaulted_loans": 0,
            },
        }

        for mfi in mfis:
            try:
                with schema_context(mfi.schema_name):
                    loans = Loan.objects.all()

                    mfi_data = {
                        "mfi_name": mfi.name,
                        "mfi_code": mfi.code,
                        "schema_name": mfi.schema_name,
                        "portfolio": loans.aggregate(
                            total_loans=Count("id"),
                            total_disbursed=Sum("loan_amount"),
                            total_repaid=Sum("repaid_amount"),
                            total_outstanding=Sum("outstanding_amount"),
                            active_count=Count("id", filter=Q(status="ACT")),
                            defaulted_count=Count("id", filter=Q(status="DEF")),
                        ),
                        "by_product": list(
                            loans.values("product_type")
                            .annotate(
                                count=Count("id"),
                                amount=Sum("loan_amount"),
                            )
                            .order_by("-amount")
                        ),
                        "wss_loans": loans.filter(water_component=True).aggregate(
                            count=Count("id"),
                            total_disbursed=Sum("loan_amount"),
                            total_outstanding=Sum("outstanding_amount"),
                        ),
                    }

                    consolidated["mfis"].append(mfi_data)

                    agg = mfi_data["portfolio"]

                    consolidated["aggregated"]["total_loans"] += (
                        agg.get("total_loans", 0) or 0
                    )

                    consolidated["aggregated"]["total_disbursed"] += float(
                        agg.get("total_disbursed", 0) or 0
                    )

                    consolidated["aggregated"]["total_repaid"] += float(
                        agg.get("total_repaid", 0) or 0
                    )

                    consolidated["aggregated"]["total_outstanding"] += float(
                        agg.get("total_outstanding", 0) or 0
                    )

                    consolidated["aggregated"]["active_loans"] += (
                        agg.get("active_count", 0) or 0
                    )

                    consolidated["aggregated"]["defaulted_loans"] += (
                        agg.get("defaulted_count", 0) or 0
                    )

            except Exception:
                continue

        cache_key = f"cross_tenant_report_aom_{aom_id}_donor_{donor_id}"
        cache.set(cache_key, consolidated, timeout=1800)

        return consolidated

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@shared_task
def update_overdue_schedules():
    """
    Nightly task to update days_overdue for all repayment schedules
    across all tenants.
    """

    from core.models import MFI

    updated_count = 0

    for mfi in MFI.objects.filter(is_active=True):
        try:
            with schema_context(mfi.schema_name):
                today = timezone.now().date()

                overdue_schedules = RepaymentSchedule.objects.filter(
                    due_date__lt=today,
                    is_paid=False,
                )

                for schedule in overdue_schedules:
                    schedule.days_overdue = (today - schedule.due_date).days
                    schedule.save(update_fields=["days_overdue"])
                    updated_count += 1

                paid_schedules = RepaymentSchedule.objects.filter(
                    is_paid=True,
                    days_overdue__gt=0,
                )

                paid_schedules.update(days_overdue=0)

        except Exception:
            continue

    return {"updated_schedules": updated_count}


@shared_task
def generate_all_mfi_reports(period_str):
    """
    Generate monthly reports for all active MFIs.
    """

    from core.models import MFI

    results = []

    for mfi in MFI.objects.filter(is_active=True):
        try:
            task = generate_monthly_mfi_report.delay(mfi.schema_name)
            results.append(
                {
                    "mfi": mfi.name,
                    "task_id": task.id,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "mfi": mfi.name,
                    "error": str(exc),
                }
            )

    return results


# =============================================================================
# CSV Import Task
# =============================================================================


@shared_task(bind=True, max_retries=3)
def import_csv_async(self, tenant_schema, csv_file_path, user_id=None):
    """
    Async CSV import task.
    """

    try:
        with schema_context(tenant_schema):
            stats = {
                "branches": 0,
                "officers": 0,
                "members": 0,
                "loans": 0,
                "errors": 0,
            }

            with open(csv_file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)

                for row in reader:
                    try:
                        with transaction.atomic():
                            process_csv_row(row, stats)
                    except Exception:
                        stats["errors"] += 1

            return stats

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


# =============================================================================
# CSV Helper Functions
# =============================================================================


def process_csv_row(row, stats):
    """
    Process a single CSV row.
    """

    row = {
        (key or "").strip(): value.strip() if isinstance(value, str) else value
        for key, value in row.items()
        if key
    }

    # 1. Branch
    branch_name = row.get("Branch Name", "").strip()

    if not branch_name:
        raise ValueError("Missing Branch Name")

    branch, branch_created = Branch.objects.get_or_create(
        name=branch_name,
        defaults={
            "code": generate_unique_code(Branch, branch_name),
        },
    )

    if branch_created:
        stats["branches"] += 1

    # 2. Loan Officer
    officer_name = row.get("Loan Officer Name", "").strip()
    officer_phone = row.get("Phone Number", "").strip()

    if officer_name:
        officer, officer_created = LoanOfficer.objects.get_or_create(
            name=officer_name,
            defaults={
                "phone": officer_phone,
                "employee_id": generate_employee_id(officer_name),
                "branch": branch,
            },
        )

        if officer_phone and officer.phone != officer_phone:
            officer.phone = officer_phone
            officer.save(update_fields=["phone"])

        if officer_created:
            stats["officers"] += 1
    else:
        officer = None

    # 3. Member
    member_name = row.get("Borrowers Name", "").strip()

    if not member_name:
        raise ValueError("Missing Borrowers Name")

    region_1 = row.get("Region 1", "").strip()
    region_2 = row.get("Region 2", "").strip()

    member_id = generate_member_id(member_name, region_1, region_2)

    street = get_or_create_geography(
        region_1,
        region_2,
        row.get("Ward", "").strip(),
        row.get("Street", "").strip(),
    )

    gender_raw = row.get("Borrowers Gender", "M").strip().upper()
    gender = gender_raw[:1] if gender_raw[:1] in ["M", "F", "O"] else "O"

    borrower_type_raw = row.get("Borrowers Type", "IND").strip().upper()

    if borrower_type_raw.startswith("G"):
        borrower_type = "GRP"
    else:
        borrower_type = "IND"

    member, member_created = Member.objects.get_or_create(
        member_id=member_id,
        defaults={
            "name": member_name,
            "gender": gender,
            "borrower_type": borrower_type,
            "region_1": region_1,
            "region_2": region_2,
            "ward": row.get("Ward", "").strip(),
            "street_name": row.get("Street", "").strip(),
            "geo_type": row.get("Geographical Type", "").strip(),
            "beneficiaries": parse_int(row.get("Number of beneficieries", 1)),
            "branch": branch,
            "loan_officer": officer,
            "street": street,
        },
    )

    if member_created:
        stats["members"] += 1

    # 4. Loan
    loan_number = row.get("Loan Number", "").strip()

    if not loan_number:
        raise ValueError("Missing Loan Number")

    if Loan.all_objects.filter(loan_number=loan_number).exists():
        return

    Loan.objects.create(
        loan_number=loan_number,
        member=member,
        branch=branch,
        loan_officer=officer,
        product_type=row.get("Product Type", "").strip(),
        disbursement_date=parse_date(row.get("Disbursment Date", "")),
        status=parse_loan_status(row.get("Loan status", "PND")),
        water_component=parse_bool(row.get("Water Component", "")),
        interest_rate=parse_decimal(row.get("Interest", 0)),
        loan_term=parse_int(row.get("Loan Term", 0)),
        loan_amount=parse_decimal(row.get("Loan Amount", 0)),
        repaid_amount=parse_decimal(row.get("Repaid Amount", 0)),
        last_report_date=parse_date(row.get("Last Report Date", "")),
    )

    stats["loans"] += 1


def get_or_create_geography(region_name, district_name, ward_name, street_name):
    """
    Create normalized geography hierarchy from CSV data.
    """

    if not region_name:
        return None

    region, _ = Region.objects.get_or_create(
        name=region_name,
        defaults={
            "code": generate_unique_code(Region, region_name),
        },
    )

    district = None

    if district_name:
        district, _ = District.objects.get_or_create(
            region=region,
            name=district_name,
            defaults={
                "code": generate_unique_code(District, district_name),
            },
        )

    ward = None

    if ward_name and district:
        ward, _ = Ward.objects.get_or_create(
            district=district,
            name=ward_name,
            defaults={
                "geo_type": Ward.GeoType.RURAL,
                "code": generate_unique_code(Ward, ward_name),
            },
        )

    street = None

    if street_name and ward:
        street, _ = Street.objects.get_or_create(
            ward=ward,
            name=street_name,
            defaults={
                "code": generate_unique_code(Street, street_name),
            },
        )

    return street


def generate_unique_code(model_class, name, max_length=20):
    """
    Generates a unique code for models that have a unique code field.
    """

    base = "".join(c.upper() for c in (name or "") if c.isalnum()).strip()

    if not base:
        base = "CODE"

    base = base[:max_length]

    code = base
    counter = 1

    while model_class.objects.filter(code=code).exists():
        suffix = str(counter)
        code = f"{base[:max_length - len(suffix)]}{suffix}"
        counter += 1

    return code


def generate_employee_id(name):
    """
    Generates a unique employee ID for loan officers.
    """

    base = "".join(c.upper() for c in (name or "") if c.isalnum())[:10]

    if not base:
        base = "LO"

    employee_id = base
    counter = 1

    while LoanOfficer.objects.filter(employee_id=employee_id).exists():
        suffix = str(counter)
        employee_id = f"{base[:50 - len(suffix)]}{suffix}"
        counter += 1

    return employee_id


def generate_member_id(name, region_1, region_2):
    """
    Generates a unique member ID.
    """

    base = "".join(c.upper() for c in (name or "") if c.isalnum())[:15]

    region_part = "".join(
        c.upper() for c in (region_1 + region_2) if c.isalnum()
    )[:10]

    member_id = f"{base}{region_part}"[:50]

    if not member_id:
        member_id = "MEMBER"

    original = member_id
    counter = 1

    while Member.objects.filter(member_id=member_id).exists():
        suffix = str(counter)
        member_id = f"{original[:50 - len(suffix)]}{suffix}"
        counter += 1

    return member_id


def parse_loan_status(value):
    """
    Maps CSV loan status values to internal loan status codes.
    """

    status_value = str(value or "").strip().upper()

    if status_value.startswith("ACT"):
        return "ACT"

    if status_value.startswith("CLO") or status_value.startswith("CLS"):
        return "CLS"

    if status_value.startswith("DEF"):
        return "DEF"

    return "PND"


def parse_date(date_str):
    """
    Parses common date formats from CSV files.
    """

    if not date_str:
        return None

    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%d.%m.%Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Unable to parse date: {date_str}")


def parse_decimal(value):
    """
    Parses decimal values from CSV files.
    """

    if value is None or value == "":
        return Decimal("0")

    try:
        return Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def parse_int(value):
    """
    Parses integer values from CSV files.
    """

    if value is None or value == "":
        return 0

    try:
        return int(float(str(value).replace(",", "")))
    except (ValueError, TypeError):
        return 0


def parse_bool(value):
    """
    Parses boolean-like values from CSV files.
    """

    if not value:
        return False

    val = str(value).strip().lower()

    return val in ["yes", "true", "1", "y", "t"]
