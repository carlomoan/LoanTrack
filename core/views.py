from decimal import Decimal

from django.db.models import Count
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

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

    filterset_fields = ["donor"]
    search_fields = ["name", "code", "contact_email"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            AoM.objects.select_related("donor")
            .annotate(mfi_count=Count("mfis"))
            .order_by("name")
        )
        return AoMPermission.scope_queryset(self.request, queryset)


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

    @action(detail=True, methods=["post"], url_path="create_schema")
    def create_schema(self, request, pk=None):
        """
        Manually trigger tenant schema creation.
        Used by Next.js: POST /api/mfis/{id}/create_schema/
        """

        mfi = self.get_object()

        try:
            mfi.save()
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

        installment.actual_paid = (installment.actual_paid or Decimal("0")) + amount
        installment.save()

        disbursement = installment.disbursement
        disbursement.repaid_amount = (
            disbursement.repaid_amount or Decimal("0")
        ) + amount
        if disbursement.outstanding_amount - amount <= 0:
            disbursement.status = MFIDisbursement.DisbursementStatus.REPAID
        disbursement.save()

        serializer = self.get_serializer(installment)
        return Response(serializer.data)
