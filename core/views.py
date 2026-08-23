import logging
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db.models import Count
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django_tenants.utils import schema_context
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from .permissions import (
    AOM_STAFF,
    AoMPermission,
    AoMReportPermission,
    DONOR_STAFF,
    DomainPermission,
    DonorContributionPermission,
    DonorPermission,
    DonorReportPermission,
    ExchangeRatePermission,
    GlobalUserPermission,
    MFI_ADMIN,
    MFI_WRITE_ROLES,
    MFIDisbursementPermission,
    MFIDisbursementRepaymentPermission,
    MFIPermission,
    MFIReportPermission,
    SUPER_ADMIN,
    get_role,
)


def _require_approver_role(request, *allowed_roles):
    """
    Separation of duty: whoever submits a report may not be the one who
    approves/rejects it. SUPER_ADMIN can always act.
    """

    role = get_role(request)
    if role == SUPER_ADMIN:
        return
    if role not in allowed_roles:
        raise PermissionDenied(
            "You are not authorized to approve or reject this report."
        )
from .models import (
    AoM,
    AoMReport,
    Domain,
    Donor,
    DonorContribution,
    DonorReport,
    ExchangeRate,
    GlobalUser,
    MFI,
    MFIDisbursement,
    MFIDisbursementRepayment,
    MFIReport,
    SystemSetting,
)
from .serializers import (
    AoMReportSerializer,
    AoMSerializer,
    DomainSerializer,
    DonorContributionSerializer,
    DonorReportSerializer,
    DonorSerializer,
    ExchangeRateSerializer,
    GlobalUserSerializer,
    MFIDetailSerializer,
    MFIDisbursementDetailSerializer,
    MFIDisbursementRepaymentSerializer,
    MFIDisbursementSerializer,
    MFIListSerializer,
    MFIReportSerializer,
)
from .signals import initialize_tenant_defaults


class DonorViewSet(viewsets.ModelViewSet):
    """
    Global donors stored in the public/shared schema.
    """

    serializer_class = DonorSerializer
    permission_classes = [permissions.IsAuthenticated, DonorPermission]

    filterset_fields = ["base_currency"]
    search_fields = ["name", "contact_email", "contact_phone"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        return DonorPermission.scope_queryset(
            self.request, Donor.objects.all().order_by("name")
        )


class AoMViewSet(viewsets.ModelViewSet):
    """
    Associations of Microfinance stored in the public/shared schema.
    """

    serializer_class = AoMSerializer
    permission_classes = [permissions.IsAuthenticated, AoMPermission]

    filterset_fields = ["donors"]
    search_fields = ["name", "code", "contact_email"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            AoM.objects.prefetch_related("donors", "mfis")
            .annotate(mfi_count=Count("mfis"))
            .order_by("name")
        )
        return AoMPermission.scope_queryset(self.request, queryset)

    @action(detail=True, methods=["post"], url_path="assign_mfi")
    def assign_mfi(self, request, pk=None):
        """
        Assign an MFI to this AoM. SUPER_ADMIN only -- org structure is a
        system-level decision, not something AoM staff self-serve.
        Accepts {"mfi": <id>}.
        """
        if get_role(request) != SUPER_ADMIN:
            raise PermissionDenied(
                "Only a super admin can assign MFIs to an AoM."
            )

        mfi_id = request.data.get("mfi")
        if not mfi_id:
            return Response(
                {"mfi": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            mfi = MFI.objects.get(pk=mfi_id)
        except MFI.DoesNotExist:
            return Response(
                {"mfi": ["MFI not found."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_aom = mfi.aom
        mfi.aom = self.get_object()
        mfi.save(update_fields=["aom", "updated_at"])

        return Response(
            {
                "detail": f"{mfi.name} assigned to {mfi.aom.name}.",
                "previous_aom": (
                    {"id": previous_aom.id, "name": previous_aom.name}
                    if previous_aom and previous_aom.id != mfi.aom.id
                    else None
                ),
                "mfi": {"id": mfi.id, "name": mfi.name, "aom": mfi.aom.id},
            }
        )


class GlobalUserViewSet(viewsets.ModelViewSet):
    """
    Global users stored in the public/shared schema.
    """

    serializer_class = GlobalUserSerializer
    permission_classes = [permissions.IsAuthenticated, GlobalUserPermission]

    filterset_fields = ["role", "aom", "donor", "mfi", "is_active", "is_staff"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "date_joined", "last_login"]
    ordering = ["username"]

    def get_queryset(self):
        queryset = GlobalUser.objects.select_related(
            "aom",
            "donor",
            "mfi",
        ).order_by("username")
        return GlobalUserPermission.scope_queryset(self.request, queryset)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        """
        Returns the currently authenticated user.
        Used by Next.js: GET /api/users/me/
        """

        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class MFIViewSet(viewsets.ModelViewSet):
    """
    MFI tenant registry stored in the public/shared schema.
    """

    serializer_class = MFIListSerializer
    permission_classes = [permissions.IsAuthenticated, MFIPermission]

    filterset_fields = [
        "aom",
        "donor",
        "is_active",
        "is_onboarded",
        "local_currency",
    ]

    search_fields = [
        "name",
        "code",
        "schema_name",
        "registration_number",
        "email",
    ]

    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = MFI.objects.select_related("aom", "donor").order_by("name")

        if self.action == "retrieve":
            queryset = queryset.prefetch_related("domains", "reports")

        return MFIPermission.scope_queryset(self.request, queryset)

    def get_serializer_class(self):
        if self.action == "list":
            return MFIListSerializer
        return MFIDetailSerializer

    def perform_create(self, serializer):
        # serializer.save() -> MFI.objects.create() -> MFI.save() runs
        # synchronously, including create_schema() -- so by the time
        # this next line runs, the tenant's schema is guaranteed to
        # exist. This is the one thing the post_save signal in
        # signals.py can't guarantee (it fires partway through
        # MFI.save(), before create_schema() has run), which is why the
        # Domain record and default region/branch/etc. are created here
        # explicitly rather than relying on the signal alone.
        mfi = serializer.save()
        try:
            initialize_tenant_defaults(mfi)
        except Exception:
            logger.exception(
                "Failed to initialize default tenant data for MFI id=%s (%s). "
                "The MFI and its schema were created successfully; retry via "
                "POST /api/mfis/%s/initialize_tenant/.",
                mfi.id,
                mfi.schema_name,
                mfi.id,
            )

    @action(detail=True, methods=["post"], url_path="create_schema")
    def create_schema(self, request, pk=None):
        """
        Manually (re)create this MFI's tenant schema and run its
        migrations -- for repairing an MFI whose schema was never
        created or never fully migrated (e.g. created before the
        onboarding fix that made this automatic, or interrupted
        partway through). Safe to call on an MFI that already has a
        working schema: check_if_exists=True makes schema creation a
        no-op in that case, and migrate_schemas is itself idempotent.
        """

        mfi = self.get_object()

        try:
            mfi.create_schema(check_if_exists=True, verbosity=1)
            initialize_tenant_defaults(mfi)

            return Response(
                {
                    "status": "schema_created",
                    "schema_name": mfi.schema_name,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="initialize_tenant")
    def initialize_tenant(self, request, pk=None):
        """
        Manually initialize default tenant data.
        """

        mfi = self.get_object()

        try:
            initialize_tenant_defaults(mfi)
            return Response(
                {
                    "status": "initialized",
                    "schema_name": mfi.schema_name,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["get"], url_path="schema_info")
    def schema_info(self, request, pk=None):
        """
        Returns basic counts from the tenant schema.
        Used by Next.js: GET /api/mfis/{id}/schema_info/
        """

        mfi = self.get_object()

        try:
            from tenants.models import Branch, Loan, LoanOfficer, Member

            with schema_context(mfi.schema_name):
                branch_count = Branch.objects.count()
                officer_count = LoanOfficer.objects.count()
                member_count = Member.objects.count()
                loan_count = Loan.objects.count()

            return Response(
                {
                    "schema_name": mfi.schema_name,
                    "branch_count": branch_count,
                    "loan_officer_count": officer_count,
                    "member_count": member_count,
                    "loan_count": loan_count,
                }
            )
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DomainViewSet(viewsets.ModelViewSet):
    """
    Tenant domains used for tenant routing.
    """

    serializer_class = DomainSerializer
    permission_classes = [permissions.IsAuthenticated, DomainPermission]

    filterset_fields = ["tenant", "is_primary"]
    search_fields = ["domain", "tenant__name"]
    ordering_fields = ["domain", "created_at"]
    ordering = ["domain"]

    def get_queryset(self):
        queryset = Domain.objects.select_related("tenant").all()
        return DomainPermission.scope_queryset(self.request, queryset)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    Exchange rates for currency conversion.
    """

    queryset = ExchangeRate.objects.all().order_by("-date")
    serializer_class = ExchangeRateSerializer
    permission_classes = [permissions.IsAuthenticated, ExchangeRatePermission]

    filterset_fields = ["from_currency", "to_currency", "date", "source"]
    search_fields = ["from_currency", "to_currency", "source"]
    ordering_fields = ["date", "created_at"]
    ordering = ["-date"]


DEFAULT_CURRENCY_KEY = "default_currency"
DEFAULT_CURRENCY_FALLBACK = "TZS"


class SystemSettingsView(APIView):
    """
    GET  /api/system-settings/   -> { default_currency: "TZS", ... }
    PUT  /api/system-settings/   -> update values (SUPER_ADMIN only)

    The default currency is what the whole UI formats money in. Tanzania's
    shilling is the shipped default; changing it is a system-admin decision,
    not a per-user preference, so writes are restricted accordingly.
    """

    EDITABLE_KEYS = {
        # key: (required pattern, error message)
        DEFAULT_CURRENCY_KEY: (
            r"^[A-Za-z]{3}$",
            "default_currency must be a 3-letter ISO code (e.g. TZS).",
        ),
    }

    def get(self, request):
        return Response(
            {
                "default_currency": SystemSetting.get(
                    DEFAULT_CURRENCY_KEY, DEFAULT_CURRENCY_FALLBACK
                ),
            }
        )

    def put(self, request):
        if get_role(request) != SUPER_ADMIN:
            raise PermissionDenied(
                "Only a super admin can change system settings."
            )

        import re

        updates = {}
        for key, (pattern, error) in self.EDITABLE_KEYS.items():
            if key not in request.data:
                continue
            value = str(request.data[key]).strip().upper()
            if not re.match(pattern, value):
                return Response(
                    {key: [error]}, status=status.HTTP_400_BAD_REQUEST
                )
            updates[key] = value

        if not updates:
            return Response(
                {"detail": "No recognized settings to update."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for key, value in updates.items():
            SystemSetting.set(key, value)

        return Response(
            {
                "default_currency": SystemSetting.get(
                    DEFAULT_CURRENCY_KEY, DEFAULT_CURRENCY_FALLBACK
                )
            }
        )


class MFIReportViewSet(viewsets.ModelViewSet):
    """
    MFI monthly reports stored in the public/shared schema.
    """

    serializer_class = MFIReportSerializer
    permission_classes = [permissions.IsAuthenticated, MFIReportPermission]

    filterset_fields = ["mfi", "status", "period"]
    search_fields = ["mfi__name", "mfi__code"]
    ordering_fields = ["period", "generated_at", "submitted_at"]
    ordering = ["-period"]

    def get_queryset(self):
        queryset = MFIReport.objects.select_related(
            "mfi",
            "mfi__aom",
            "mfi__donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")
        return MFIReportPermission().scope_queryset(self.request, queryset)

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        report = self.get_object()

        if report.status == MFIReport.ReportStatus.APPROVED:
            return Response(
                {"error": "Approved reports cannot be resubmitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = MFIReport.ReportStatus.SUBMITTED
        report.submitted_at = timezone.now()
        report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        _require_approver_role(request, AOM_STAFF)
        report = self.get_object()

        if report.status == MFIReport.ReportStatus.APPROVED:
            return Response(
                {"error": "Report is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = MFIReport.ReportStatus.APPROVED
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        _require_approver_role(request, AOM_STAFF)
        report = self.get_object()

        if report.status == MFIReport.ReportStatus.APPROVED:
            return Response(
                {"error": "Approved reports cannot be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = MFIReport.ReportStatus.REJECTED
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data)


class AoMReportViewSet(viewsets.ModelViewSet):
    """
    Consolidated AoM reports stored in the public/shared schema.
    """

    serializer_class = AoMReportSerializer
    permission_classes = [permissions.IsAuthenticated, AoMReportPermission]

    filterset_fields = ["aom", "status", "period"]
    search_fields = ["aom__name", "aom__code"]
    ordering_fields = ["period", "generated_at"]
    ordering = ["-period"]

    def get_queryset(self):
        queryset = AoMReport.objects.select_related(
            "aom",
            "aom__donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")
        return AoMReportPermission().scope_queryset(self.request, queryset)

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        _require_approver_role(request, DONOR_STAFF)
        report = self.get_object()

        if report.status == AoMReport.ReportStatus.APPROVED:
            return Response(
                {"error": "Report is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = AoMReport.ReportStatus.APPROVED
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data)


class DonorReportViewSet(viewsets.ModelViewSet):
    """
    Consolidated Donor reports stored in the public/shared schema.
    """

    serializer_class = DonorReportSerializer
    permission_classes = [permissions.IsAuthenticated, DonorReportPermission]

    filterset_fields = ["donor", "status", "period"]
    search_fields = ["donor__name"]
    ordering_fields = ["period", "generated_at"]
    ordering = ["-period"]

    def get_queryset(self):
        queryset = DonorReport.objects.select_related(
            "donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")
        return DonorReportPermission().scope_queryset(self.request, queryset)

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        _require_approver_role(request)  # SUPER_ADMIN only
        report = self.get_object()

        if report.status == DonorReport.ReportStatus.APPROVED:
            return Response(
                {"error": "Report is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = DonorReport.ReportStatus.APPROVED
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data)


# =============================================================================
# Fund flow: Donor -> AoM -> MFI
# =============================================================================


class DonorContributionViewSet(viewsets.ModelViewSet):
    """Capital a Donor has injected into an AoM."""

    serializer_class = DonorContributionSerializer
    permission_classes = [permissions.IsAuthenticated, DonorContributionPermission]

    filterset_fields = ["donor", "aom"]
    search_fields = ["donor__name", "aom__name", "reference"]
    ordering_fields = ["contribution_date", "amount"]
    ordering = ["-contribution_date"]

    def get_queryset(self):
        queryset = DonorContribution.objects.select_related(
            "donor", "aom", "recorded_by"
        ).order_by("-contribution_date")
        return DonorContributionPermission.scope_queryset(self.request, queryset)

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class MFIDisbursementViewSet(viewsets.ModelViewSet):
    """
    A wholesale loan from an AoM to one of its MFIs -- the capital the
    MFI re-lends onward to individual members (tracked separately, per
    tenant, as tenants.models.Loan).
    """

    permission_classes = [permissions.IsAuthenticated, MFIDisbursementPermission]

    filterset_fields = ["aom", "mfi", "status"]
    search_fields = ["aom__name", "mfi__name"]
    ordering_fields = ["disbursement_date", "principal_amount"]
    ordering = ["-disbursement_date"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MFIDisbursementDetailSerializer
        return MFIDisbursementSerializer

    def get_queryset(self):
        queryset = MFIDisbursement.objects.select_related(
            "aom", "mfi", "created_by"
        ).order_by("-disbursement_date")

        if self.action == "retrieve":
            queryset = queryset.prefetch_related("schedule")

        return MFIDisbursementPermission.scope_queryset(self.request, queryset)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="generate-schedule")
    def generate_schedule(self, request, pk=None):
        disbursement = self.get_object()

        try:
            total_due = disbursement.generate_schedule()
        except Exception as exc:  # noqa: BLE001 - surfaced as a 400 either way
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        disbursement.status = MFIDisbursement.DisbursementStatus.ACTIVE
        disbursement.save(update_fields=["status"])

        serializer = MFIDisbursementDetailSerializer(disbursement)
        return Response(
            {"total_due": total_due, "disbursement": serializer.data}
        )


class MFIDisbursementRepaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Repayment schedule for a wholesale disbursement. Read-only through
    the standard list/retrieve actions; recording an actual payment goes
    through the dedicated `record_payment` action so the amount and date
    are validated together rather than allowing an arbitrary PATCH.
    """

    serializer_class = MFIDisbursementRepaymentSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        MFIDisbursementRepaymentPermission,
    ]

    filterset_fields = ["disbursement", "is_paid"]
    ordering_fields = ["due_date", "installment_number"]
    ordering = ["disbursement", "installment_number"]

    def get_queryset(self):
        queryset = MFIDisbursementRepayment.objects.select_related(
            "disbursement", "disbursement__aom", "disbursement__mfi"
        ).order_by("disbursement", "installment_number")
        return MFIDisbursementRepaymentPermission.scope_queryset(
            self.request, queryset
        )

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        installment = self.get_object()
        role = get_role(request)

        # Recording that the MFI has paid is the AoM's bookkeeping act
        # (they're confirming money arrived), not the MFI's -- an MFI
        # marking its own debt as paid with no counterparty confirmation
        # would defeat the point of tracking this at all.
        if role not in (SUPER_ADMIN, AOM_STAFF):
            raise PermissionDenied(
                "Only the AoM that issued this disbursement can record a payment against it."
            )

        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except Exception:
            return Response(
                {"detail": "amount must be a number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {"detail": "amount must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Partial payments are allowed: an MFI can pay less than the full
        # installment and the remainder stays due. Overpayment beyond this
        # installment's remaining balance is rejected -- it belongs on a
        # later installment, not silently absorbed here.
        remaining = installment.remaining_amount
        if amount > remaining:
            return Response(
                {
                    "detail": (
                        f"Amount exceeds this installment's remaining "
                        f"balance of {remaining}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            installment = MFIDisbursementRepayment.objects.select_for_update().get(pk=installment.pk)
            installment.actual_paid = (installment.actual_paid or Decimal("0")) + amount
            installment.save()

            disbursement = MFIDisbursement.objects.select_for_update().get(pk=installment.disbursement_id)
            disbursement.repaid_amount = (
                disbursement.repaid_amount or Decimal("0")
            ) + amount
            # save() recomputes outstanding_amount = principal - repaid.
            if disbursement.repaid_amount >= disbursement.principal_amount:
                disbursement.status = MFIDisbursement.DisbursementStatus.REPAID
            elif disbursement.status == MFIDisbursement.DisbursementStatus.PENDING:
                disbursement.status = MFIDisbursement.DisbursementStatus.ACTIVE
            disbursement.save()

        serializer = self.get_serializer(installment)
        return Response(serializer.data)


# =============================================================================
# Notifications
# =============================================================================


class NotificationsViewSet(viewsets.ViewSet):
    """
    Real, queryable counts of things this specific user has to act on --
    not a stored notification log, just a live summary computed from data
    that already exists and is already scoped to their organization via
    the same permission classes used everywhere else. Reuses each
    resource's own scope_queryset so this can never show a count wider
    than what the user could actually open and act on.
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        role = get_role(request)
        items = []

        # Reports awaiting approval -- only surfaced to the role that can
        # actually approve them (mirrors the separation-of-duty rules on
        # the approve/reject actions themselves).
        if role in (SUPER_ADMIN, AOM_STAFF):
            count = MFIReportPermission().scope_queryset(
                request, MFIReport.objects.filter(status="SUBMITTED")
            ).count()
            if count:
                items.append(
                    {
                        "type": "mfi_report_pending",
                        "count": count,
                        "label": f"{count} MFI report{'s' if count != 1 else ''} awaiting approval",
                        "href": "/dashboard/organizations/reports",
                    }
                )

        if role in (SUPER_ADMIN, DONOR_STAFF):
            count = AoMReportPermission().scope_queryset(
                request, AoMReport.objects.filter(status="SUBMITTED")
            ).count()
            if count:
                items.append(
                    {
                        "type": "aom_report_pending",
                        "count": count,
                        "label": f"{count} AoM report{'s' if count != 1 else ''} awaiting approval",
                        "href": "/dashboard/organizations/reports",
                    }
                )

        if role == SUPER_ADMIN:
            count = DonorReportPermission().scope_queryset(
                request, DonorReport.objects.filter(status="SUBMITTED")
            ).count()
            if count:
                items.append(
                    {
                        "type": "donor_report_pending",
                        "count": count,
                        "label": f"{count} donor report{'s' if count != 1 else ''} awaiting approval",
                        "href": "/dashboard/organizations/reports",
                    }
                )

        # Overdue wholesale disbursement installments -- relevant to
        # whoever issued the loan (AoM) and whoever owes it (MFI), not to
        # loan officers (that's the individual-lending layer, a
        # different concern).
        if role in (SUPER_ADMIN, AOM_STAFF) or role in MFI_WRITE_ROLES:
            overdue_qs = MFIDisbursementRepaymentPermission.scope_queryset(
                request,
                MFIDisbursementRepayment.objects.filter(
                    is_paid=False, due_date__lt=timezone.now().date()
                ),
            )
            count = overdue_qs.count()
            if count:
                items.append(
                    {
                        "type": "disbursement_overdue",
                        "count": count,
                        "label": f"{count} wholesale repayment installment{'s' if count != 1 else ''} overdue",
                        "href": "/dashboard/organizations?tab=disbursements",
                    }
                )

        return Response(
            {"items": items, "total": sum(item["count"] for item in items)}
        )


# =============================================================================
# Activity Log
# =============================================================================

HISTORY_TYPE_LABELS = {"+": "created", "~": "changed", "-": "deleted"}


def _serialize_history_row(model_label, row, label_fn):
    return {
        "model": model_label,
        "object_id": row.id,
        "label": label_fn(row),
        "change_type": HISTORY_TYPE_LABELS.get(row.history_type, row.history_type),
        "changed_by": (
            row.history_user.get_full_name() or row.history_user.username
            if row.history_user
            else None
        ),
        "changed_at": row.history_date,
    }


class ActivityLogViewSet(viewsets.ViewSet):
    """
    A live feed of who changed what, when -- built directly from the
    simple_history records every model in this app already keeps, not a
    separate log that could drift out of sync with what actually
    happened. Every entry here reflects a real save() call, scoped so a
    caller only ever sees changes to records they could otherwise see
    through the normal API (no widening the audience for "it's just a
    log").
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def feed(self, request):
        role = get_role(request)
        user = request.user
        entries = []

        def add(qs, model_label, label_fn, limit=50):
            for row in qs.order_by("-history_date")[:limit]:
                entries.append(_serialize_history_row(model_label, row, label_fn))

        if role == SUPER_ADMIN:
            add(Donor.history.all(), "Donor", lambda r: r.name)
            add(AoM.history.all(), "AoM", lambda r: r.name)
            add(MFI.history.all(), "MFI", lambda r: r.name)
            add(GlobalUser.history.all(), "User", lambda r: r.username)
            add(MFIReport.history.all(), "MFI Report", lambda r: f"Report for MFI #{r.mfi_id}, {r.period}")
            add(AoMReport.history.all(), "AoM Report", lambda r: f"Report for AoM #{r.aom_id}, {r.period}")
            add(DonorReport.history.all(), "Donor Report", lambda r: f"Report for Donor #{r.donor_id}, {r.period}")
            add(DonorContribution.history.all(), "Donor Contribution", lambda r: f"{r.amount} {r.currency}")
            add(MFIDisbursement.history.all(), "Disbursement", lambda r: f"{r.principal_amount} {r.currency}")

        elif role == AOM_STAFF:
            own_mfi_ids = list(
                MFI.objects.filter(aom_id=user.aom_id).values_list("id", flat=True)
            )
            add(
                MFI.history.filter(aom_id=user.aom_id), "MFI", lambda r: r.name
            )
            add(
                GlobalUser.history.filter(mfi_id__in=own_mfi_ids), "User", lambda r: r.username
            )
            add(
                MFIReport.history.filter(mfi_id__in=own_mfi_ids),
                "MFI Report",
                lambda r: f"Report for MFI #{r.mfi_id}, {r.period}",
            )
            add(
                DonorContribution.history.filter(aom_id=user.aom_id),
                "Donor Contribution",
                lambda r: f"{r.amount} {r.currency}",
            )
            add(
                MFIDisbursement.history.filter(aom_id=user.aom_id),
                "Disbursement",
                lambda r: f"{r.principal_amount} {r.currency}",
            )

        elif role == DONOR_STAFF:
            own_aom_ids = list(
                AoM.objects.filter(donor_id=user.donor_id).values_list("id", flat=True)
            )
            add(
                AoM.history.filter(donor_id=user.donor_id), "AoM", lambda r: r.name
            )
            add(
                AoMReport.history.filter(aom_id__in=own_aom_ids),
                "AoM Report",
                lambda r: f"Report for AoM #{r.aom_id}, {r.period}",
            )
            add(
                DonorReport.history.filter(donor_id=user.donor_id),
                "Donor Report",
                lambda r: f"Report for Donor #{r.donor_id}, {r.period}",
            )
            add(
                DonorContribution.history.filter(donor_id=user.donor_id),
                "Donor Contribution",
                lambda r: f"{r.amount} {r.currency}",
            )

        elif role in MFI_WRITE_ROLES:  # MFI_ADMIN, MFI_MANAGER
            add(
                MFIReport.history.filter(mfi_id=user.mfi_id),
                "MFI Report",
                lambda r: f"Report for {r.period}",
            )
            add(
                MFIDisbursement.history.filter(mfi_id=user.mfi_id),
                "Disbursement",
                lambda r: f"{r.principal_amount} {r.currency}",
            )
            if role == "MFI_ADMIN":
                add(
                    GlobalUser.history.filter(mfi_id=user.mfi_id),
                    "User",
                    lambda r: r.username,
                )

        # role == LOAN_OFFICER or anything else: no org-level activity log
        # entries -- this is financial/strategic visibility, matching the
        # same rule already applied to MFIDisbursement itself.

        entries.sort(key=lambda e: e["changed_at"], reverse=True)
        return Response({"results": entries[:100]})


# =============================================================================
# Password reset
# =============================================================================
# Deliberately plain function-based views rather than DRF's built-in
# password reset (which assumes Django's session-based admin flow) --
# this is a small, self-contained JSON API matching how the rest of this
# app talks to the frontend.


def _send_password_reset_email(user, uid, token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
    send_mail(
        subject="Reset your LoanTrack password",
        message=(
            f"Hi {user.get_full_name() or user.username},\n\n"
            f"Use the link below to set a new password. This link expires "
            f"in a few hours and can only be used once.\n\n"
            f"{reset_url}\n\n"
            f"If you didn't request this, you can safely ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class PasswordResetRequestView(APIView):
    """
    POST {"email": "..."} -> always 200 with a generic message, whether
    or not that email is registered. Returning a different response for
    "not found" is a classic account-enumeration leak -- a real MFI
    manager's email showing up as "not found" vs "reset sent" tells an
    attacker who has an account here.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        generic_response = Response(
            {
                "detail": (
                    "If an account exists for that email, a reset link "
                    "has been sent."
                )
            },
            status=status.HTTP_200_OK,
        )

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # email isn't a unique field on GlobalUser (it extends
        # AbstractUser, which only enforces uniqueness on username), so
        # in the rare case more than one account shares an email, every
        # matching active account gets its own reset link rather than
        # guessing which one the person meant.
        matching_users = GlobalUser.objects.filter(
            email__iexact=email, is_active=True
        )

        token_generator = PasswordResetTokenGenerator()
        for user in matching_users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_generator.make_token(user)
            try:
                _send_password_reset_email(user, uid, token)
            except Exception:
                logger.exception(
                    "Failed to send password reset email to user id=%s", user.pk
                )

        return generic_response


class PasswordResetConfirmView(APIView):
    """
    POST {"uid": "...", "token": "...", "new_password": "..."} -> sets
    the new password if the uid/token pair is valid and not expired.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password") or ""

        if not uid or not token or not new_password:
            return Response(
                {"detail": "uid, token, and new_password are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = GlobalUser.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, GlobalUser.DoesNotExist):
            return Response(
                {"detail": "This reset link is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response(
                {"detail": "This reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response(
            {"detail": "Password has been reset. You can now sign in."},
            status=status.HTTP_200_OK,
        )
