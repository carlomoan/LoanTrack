from django.db.models import Count
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    AoM,
    AoMReport,
    Domain,
    Donor,
    DonorReport,
    ExchangeRate,
    GlobalUser,
    MFI,
    MFIReport,
)
from .serializers import (
    AoMReportSerializer,
    AoMSerializer,
    DomainSerializer,
    DonorReportSerializer,
    DonorSerializer,
    ExchangeRateSerializer,
    GlobalUserSerializer,
    MFIDetailSerializer,
    MFIListSerializer,
    MFIReportSerializer,
)
from .signals import initialize_tenant_defaults


class DonorViewSet(viewsets.ModelViewSet):
    """
    Global donors stored in the public/shared schema.
    """

    queryset = Donor.objects.all().order_by("name")
    serializer_class = DonorSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["base_currency"]
    search_fields = ["name", "contact_email", "contact_phone"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class AoMViewSet(viewsets.ModelViewSet):
    """
    Associations of Microfinance stored in the public/shared schema.
    """

    serializer_class = AoMSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["donor"]
    search_fields = ["name", "code", "contact_email"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            AoM.objects.select_related("donor")
            .annotate(mfi_count=Count("mfis"))
            .order_by("name")
        )


class GlobalUserViewSet(viewsets.ModelViewSet):
    """
    Global users stored in the public/shared schema.
    """

    serializer_class = GlobalUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["role", "aom", "donor", "mfi", "is_active", "is_staff"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "date_joined", "last_login"]
    ordering = ["username"]

    def get_queryset(self):
        return GlobalUser.objects.select_related(
            "aom",
            "donor",
            "mfi",
        ).order_by("username")

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
    permission_classes = [permissions.IsAuthenticated]

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

        return queryset

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
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["tenant", "is_primary"]
    search_fields = ["domain", "tenant__name"]
    ordering_fields = ["domain", "created_at"]
    ordering = ["domain"]

    def get_queryset(self):
        return Domain.objects.select_related("tenant").all()


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    Exchange rates for currency conversion.
    """

    queryset = ExchangeRate.objects.all().order_by("-date")
    serializer_class = ExchangeRateSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["from_currency", "to_currency", "date", "source"]
    search_fields = ["from_currency", "to_currency", "source"]
    ordering_fields = ["date", "created_at"]
    ordering = ["-date"]


class MFIReportViewSet(viewsets.ModelViewSet):
    """
    MFI monthly reports stored in the public/shared schema.
    """

    serializer_class = MFIReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["mfi", "status", "period"]
    search_fields = ["mfi__name", "mfi__code"]
    ordering_fields = ["period", "generated_at", "submitted_at"]
    ordering = ["-period"]

    def get_queryset(self):
        return MFIReport.objects.select_related(
            "mfi",
            "mfi__aom",
            "mfi__donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")

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
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["aom", "status", "period"]
    search_fields = ["aom__name", "aom__code"]
    ordering_fields = ["period", "generated_at"]
    ordering = ["-period"]

    def get_queryset(self):
        return AoMReport.objects.select_related(
            "aom",
            "aom__donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
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
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["donor", "status", "period"]
    search_fields = ["donor__name"]
    ordering_fields = ["period", "generated_at"]
    ordering = ["-period"]

    def get_queryset(self):
        return DonorReport.objects.select_related(
            "donor",
            "generated_by",
            "approved_by",
        ).order_by("-period")

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
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
