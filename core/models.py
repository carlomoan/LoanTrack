from datetime import date as date_type
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_tenants.models import DomainMixin, TenantMixin
from simple_history.models import HistoricalRecords


def first_day_of_month_validator(value):
    if value and value.day != 1:
        raise ValidationError(_("Period must be the first day of the month."))


class Donor(models.Model):
    name = models.CharField(max_length=255, unique=True, db_index=True)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    base_currency = models.CharField(max_length=3, default="USD")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_donor"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class AoM(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)

    donor = models.ForeignKey(
        Donor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="aoms",
    )

    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_aom"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class GlobalUser(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", _("Super Admin")
        AOM_STAFF = "AOM_STAFF", _("AoM Staff")
        DONOR_STAFF = "DONOR_STAFF", _("Donor Staff")
        MFI_ADMIN = "MFI_ADMIN", _("MFI Admin")
        MFI_MANAGER = "MFI_MANAGER", _("MFI Manager")
        LOAN_OFFICER = "LOAN_OFFICER", _("Loan Officer")

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.LOAN_OFFICER,
        db_index=True,
    )

    aom = models.ForeignKey(
        AoM,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )

    donor = models.ForeignKey(
        Donor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )

    mfi = models.ForeignKey(
        "MFI",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta(AbstractUser.Meta):
        abstract = False
        db_table = "core_globaluser"
        swappable = "AUTH_USER_MODEL"
        indexes = [
            models.Index(fields=["role", "mfi"]),
            models.Index(fields=["role", "aom"]),
        ]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"


class MFI(TenantMixin):
    objects = models.Manager()

    name = models.CharField(max_length=255)
    schema_name = models.CharField(max_length=63, unique=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)

    registration_number = models.CharField(max_length=100, unique=True)
    license_number = models.CharField(max_length=100, blank=True)

    email = models.EmailField()
    phone = models.CharField(max_length=50)
    address = models.TextField()
    local_currency = models.CharField(max_length=3, default="TZS")

    aom = models.ForeignKey(
        AoM,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mfis",
    )

    donor = models.ForeignKey(
        Donor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mfis",
    )

    is_active = models.BooleanField(default=True, db_index=True)
    is_onboarded = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    auto_create_schema = True
    auto_drop_schema = False

    history = HistoricalRecords()

    class Meta(TenantMixin.Meta):
        abstract = False
        db_table = "core_mfi"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def _generate_unique_schema_name(self) -> str:
        base_name = "".join(
            c.lower() if c.isalnum() else "_" for c in self.name
        ).strip("_")

        if not base_name:
            base_name = "mfi"

        base_schema = f"tenant_{base_name}"[:63]

        queryset = MFI.objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        candidate = base_schema
        counter = 1

        while queryset.filter(schema_name=candidate).exists():
            suffix = f"_{counter}"
            candidate = f"{base_schema[:63 - len(suffix)]}{suffix}"
            counter += 1

        return candidate

    def _generate_unique_code(self) -> str:
        base_code = "".join(
            c.upper() for c in self.name if c.isalnum()
        ).strip()

        if not base_code:
            base_code = "MFI"

        base_code = base_code[:20]

        queryset = MFI.objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        candidate = base_code
        counter = 1

        while queryset.filter(code=candidate).exists():
            suffix = str(counter)
            candidate = f"{base_code[:20 - len(suffix)]}{suffix}"
            counter += 1

        return candidate

    def save(self, *args, **kwargs):
        if not self.schema_name:
            self.schema_name = self._generate_unique_schema_name()

        if not self.code:
            self.code = self._generate_unique_code()

        super().save(*args, **kwargs)


class ExchangeRate(models.Model):
    """
    Exchange rates for currency conversion.
    """

    from_currency = models.CharField(max_length=3)
    to_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=12, decimal_places=6)
    date = models.DateField()

    source = models.CharField(max_length=100, default="manual")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_exchangerate"
        unique_together = ["from_currency", "to_currency", "date"]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["from_currency", "to_currency", "date"]),
        ]

    def __str__(self) -> str:
        return f"{self.from_currency} -> {self.to_currency} = {self.rate} on {self.date}"

    @classmethod
    def get_rate(
        cls,
        from_currency: str,
        to_currency: str,
        date: date_type | None = None,
    ) -> Decimal | None:
        """
        Get exchange rate for a specific date, or latest available rate.
        """

        if from_currency == to_currency:
            return Decimal("1.000000")

        queryset = cls.objects.filter(
            from_currency=from_currency,
            to_currency=to_currency,
        )

        if date:
            queryset = queryset.filter(date__lte=date)

        rate_obj = queryset.order_by("-date").first()

        if rate_obj:
            return rate_obj.rate

        # Try reverse rate
        reverse_queryset = cls.objects.filter(
            from_currency=to_currency,
            to_currency=from_currency,
        )

        if date:
            reverse_queryset = reverse_queryset.filter(date__lte=date)

        reverse_rate_obj = reverse_queryset.order_by("-date").first()

        if reverse_rate_obj and reverse_rate_obj.rate:
            return Decimal("1.000000") / reverse_rate_obj.rate

        return None


class Domain(DomainMixin):
    """
    Domain mapping for tenant routing.
    """

    history = HistoricalRecords()

    class Meta(DomainMixin.Meta):
        abstract = False
        db_table = "core_domain"

    def __str__(self) -> str:
        return str(self.domain)


# =============================================================================
# Reporting Models (Shared Schema)
# =============================================================================


class MFIReport(models.Model):
    """
    Monthly report submitted by MFI.
    Stored in public/shared schema for cross-tenant access.
    """

    class ReportStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    mfi = models.ForeignKey(
        MFI,
        on_delete=models.CASCADE,
        related_name="reports",
    )

    period = models.DateField(
        validators=[first_day_of_month_validator],
        help_text="First day of the month, e.g. 2026-08-01",
    )

    status = models.CharField(
        max_length=10,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
    )

    payload = models.JSONField(default=dict)

    local_currency = models.CharField(max_length=3, blank=True)
    base_currency = models.CharField(max_length=3, blank=True)
    exchange_rate = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=1,
    )

    generated_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_reports",
    )

    generated_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    approved_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_reports",
    )

    approved_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_mfireport"
        unique_together = ["mfi", "period"]
        ordering = ["-period"]
        indexes = [
            models.Index(fields=["mfi", "period"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.mfi.name} - {self.period.strftime('%Y-%m')} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.local_currency and self.mfi_id:
            self.local_currency = self.mfi.local_currency

        if not self.base_currency and self.mfi_id:
            if self.mfi.donor:
                self.base_currency = self.mfi.donor.base_currency
            elif self.mfi.aom and self.mfi.aom.donor:
                self.base_currency = self.mfi.aom.donor.base_currency

        super().save(*args, **kwargs)


class AoMReport(models.Model):
    """
    Consolidated report for an AoM.
    Aggregated from MFI reports.
    """

    class ReportStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        GENERATED = "GENERATED", "Generated"
        APPROVED = "APPROVED", "Approved"

    aom = models.ForeignKey(
        AoM,
        on_delete=models.CASCADE,
        related_name="consolidated_reports",
    )

    period = models.DateField(
        validators=[first_day_of_month_validator],
        help_text="First day of the month",
    )

    status = models.CharField(
        max_length=10,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
    )

    payload = models.JSONField(default=dict)

    base_currency = models.CharField(max_length=3, blank=True)

    source_reports = models.ManyToManyField(
        MFIReport,
        related_name="aom_consolidations",
        blank=True,
    )

    generated_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_aom_reports",
    )

    generated_at = models.DateTimeField(auto_now_add=True)

    approved_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_aom_reports",
    )

    approved_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_aomreport"
        unique_together = ["aom", "period"]
        ordering = ["-period"]
        indexes = [
            models.Index(fields=["aom", "period"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.aom.name} - {self.period.strftime('%Y-%m')} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.base_currency and self.aom_id:
            if self.aom.donor:
                self.base_currency = self.aom.donor.base_currency

        super().save(*args, **kwargs)


class DonorReport(models.Model):
    """
    Consolidated report for a Donor.
    Aggregated from AoM reports.
    """

    class ReportStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        GENERATED = "GENERATED", "Generated"
        APPROVED = "APPROVED", "Approved"

    donor = models.ForeignKey(
        Donor,
        on_delete=models.CASCADE,
        related_name="consolidated_reports",
    )

    period = models.DateField(
        validators=[first_day_of_month_validator],
        help_text="First day of the month",
    )

    status = models.CharField(
        max_length=10,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
    )

    payload = models.JSONField(default=dict)

    base_currency = models.CharField(max_length=3, blank=True)

    source_reports = models.ManyToManyField(
        AoMReport,
        related_name="donor_consolidations",
        blank=True,
    )

    generated_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_donor_reports",
    )

    generated_at = models.DateTimeField(auto_now_add=True)

    approved_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_donor_reports",
    )

    approved_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_donorreport"
        unique_together = ["donor", "period"]
        ordering = ["-period"]
        indexes = [
            models.Index(fields=["donor", "period"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.donor.name} - {self.period.strftime('%Y-%m')} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.base_currency and self.donor_id:
            self.base_currency = self.donor.base_currency

        super().save(*args, **kwargs)
