from datetime import date as date_type
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django_tenants.models import DomainMixin, TenantMixin
from simple_history.models import HistoricalRecords


def first_day_of_month_validator(value):
    if value and value.day != 1:
        raise ValidationError(_("Period must be the first day of the month."))


class SystemSetting(models.Model):
    """
    Singleton key/value store for system-wide configuration.

    Currently holds the default display currency (TZS for Tanzania).
    Only SUPER_ADMINs may change these values; every other role reads
    them so the UI formats money consistently across the app.
    """

    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.CharField(max_length=255, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_systemsetting"

    def __str__(self) -> str:
        return f"{self.key}={self.value}"

    @classmethod
    def get(cls, key: str, default: str = "") -> str:
        return getattr(
            cls.objects.filter(key=key).first(), "value", default
        )

    @classmethod
    def set(cls, key: str, value: str) -> "SystemSetting":
        obj, _ = cls.objects.update_or_create(key=key, defaults={"value": value})
        return obj


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

    # There is a single AoM in this deployment, funded by many donors --
    # so this is many-to-many, not a single sponsoring-donor FK. The
    # per-donation money trail lives in DonorContribution (donor -> AoM).
    donors = models.ManyToManyField(
        Donor,
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
            elif self.mfi.aom:
                first_donor = self.mfi.aom.donors.first()
                if first_donor:
                    self.base_currency = first_donor.base_currency

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
            first_donor = self.aom.donors.first() if self.aom_id else None
            if first_donor:
                self.base_currency = first_donor.base_currency

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


# =============================================================================
# Fund flow: Donor -> AoM -> MFI -> individual member
# =============================================================================
# The retail side (MFI lending to individual members, with its own
# interest rate/term/repayment schedule) lives entirely in the tenant
# schema -- see tenants.models.Loan / RepaymentSchedule. This section
# models the wholesale side one tier up: a donor injecting capital into
# an AoM, and the AoM re-lending that capital onward to its MFIs on its
# own rate/term, with its own repayment schedule as the MFI pays it back.
#
# These live in the public schema (not a tenant schema) because they
# describe a relationship *between* AoM and MFI as organizations, not
# operational data belonging to one MFI's tenant -- an AoM needs to see
# and manage its disbursements to every MFI it funds in one place.


class DonorContribution(models.Model):
    """
    A capital injection from a Donor into an AoM. This is the top of the
    fund-flow chain: money the AoM can then disburse onward to its MFIs
    via MFIDisbursement.
    """

    donor = models.ForeignKey(
        Donor,
        on_delete=models.CASCADE,
        related_name="contributions",
    )

    aom = models.ForeignKey(
        AoM,
        on_delete=models.CASCADE,
        related_name="contributions",
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")

    contribution_date = models.DateField()
    reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Wire transfer reference or other external reference.",
    )
    notes = models.TextField(blank=True)

    recorded_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_donor_contributions",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_donorcontribution"
        ordering = ["-contribution_date"]
        indexes = [
            models.Index(fields=["donor", "aom"]),
            models.Index(fields=["contribution_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.donor.name} -> {self.aom.name}: {self.amount} {self.currency}"

    def clean(self):
        # A donor can only fund an AoM it actually sponsors -- otherwise
        # this record wouldn't reconcile against anything.
        if self.aom_id and self.donor_id and not self.aom.donors.filter(
            id=self.donor_id
        ).exists():
            raise ValidationError(
                "This donor does not fund the selected AoM."
            )


class MFIDisbursement(models.Model):
    """
    A wholesale loan from an AoM to one of its MFIs -- the capital the MFI
    then re-lends to individual members at its own rate/term (tracked
    separately, per-tenant, as tenants.models.Loan). Mirrors the shape of
    Loan/RepaymentSchedule one tier up: principal, rate, term, and an
    auto-generated repayment schedule the MFI pays down over time.
    """

    class DisbursementStatus(models.TextChoices):
        PENDING = "PND", "Pending"
        ACTIVE = "ACT", "Active"
        REPAID = "RPD", "Repaid"
        DEFAULTED = "DEF", "Defaulted"
        CANCELLED = "CAN", "Cancelled"

    aom = models.ForeignKey(
        AoM,
        on_delete=models.CASCADE,
        related_name="disbursements",
    )

    mfi = models.ForeignKey(
        MFI,
        on_delete=models.CASCADE,
        related_name="disbursements",
    )

    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")

    # The rate the AoM charges the MFI on this wholesale loan -- distinct
    # from, and generally lower than, the rate the MFI in turn charges its
    # individual borrowers.
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    term_months = models.PositiveIntegerField()
    disbursement_date = models.DateField()

    status = models.CharField(
        max_length=3,
        choices=DisbursementStatus.choices,
        default=DisbursementStatus.PENDING,
    )

    repaid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    outstanding_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_disbursements",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_mfidisbursement"
        ordering = ["-disbursement_date"]
        indexes = [
            models.Index(fields=["aom", "mfi"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.aom.name} -> {self.mfi.name}: {self.principal_amount} {self.currency}"

    def clean(self):
        # A wholesale loan only makes sense between an AoM and one of its
        # own MFIs.
        if self.mfi_id and self.aom_id and self.mfi.aom_id != self.aom_id:
            raise ValidationError(
                "This MFI does not belong to the selected AoM."
            )

    def save(self, *args, **kwargs):
        principal = Decimal(str(self.principal_amount or "0"))
        repaid = Decimal(str(self.repaid_amount or "0"))
        self.outstanding_amount = max(Decimal("0.00"), principal - repaid)
        super().save(*args, **kwargs)

    def generate_schedule(self):
        """
        Builds a flat-rate, equal-installment monthly repayment schedule
        for this disbursement -- the same flat-interest style already
        used for individual member loans in the tenant schema. Replaces
        any existing schedule rows for this disbursement. Safe to call
        again if the terms change before any repayment has been recorded.
        """
        if self.schedule.filter(actual_paid__gt=0).exists():
            raise ValidationError(
                "Cannot regenerate a schedule that already has repayments recorded."
            )

        self.schedule.all().delete()

        principal = self.principal_amount
        total_interest = (
            principal * (self.interest_rate / Decimal("100")) *
            (Decimal(self.term_months) / Decimal("12"))
        )
        total_due = principal + total_interest

        installment_principal = (principal / self.term_months).quantize(Decimal("0.01"))
        installment_interest = (total_interest / self.term_months).quantize(Decimal("0.01"))

        rows = []
        running_principal = Decimal("0.00")
        running_interest = Decimal("0.00")

        for i in range(1, self.term_months + 1):
            is_last = i == self.term_months
            due_date = _add_months(self.disbursement_date, i)

            principal_i = (
                principal - running_principal if is_last else installment_principal
            )
            interest_i = (
                total_interest - running_interest if is_last else installment_interest
            )

            running_principal += principal_i
            running_interest += interest_i

            rows.append(
                MFIDisbursementRepayment(
                    disbursement=self,
                    installment_number=i,
                    due_date=due_date,
                    expected_principal=principal_i,
                    expected_interest=interest_i,
                    expected_total=principal_i + interest_i,
                )
            )

        MFIDisbursementRepayment.objects.bulk_create(rows)
        return total_due


def _add_months(start_date, months):
    month_index = start_date.month - 1 + months
    year = start_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(
        start_date.day,
        [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
         31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
    )
    return date_type(year, month, day)


class MFIDisbursementRepayment(models.Model):
    """
    One installment of an MFI paying an AoM back for a wholesale
    disbursement. Mirrors tenants.models.RepaymentSchedule's shape and
    save()/overdue logic one tier up.
    """

    disbursement = models.ForeignKey(
        MFIDisbursement,
        on_delete=models.CASCADE,
        related_name="schedule",
    )

    installment_number = models.IntegerField()
    due_date = models.DateField()

    expected_principal = models.DecimalField(max_digits=14, decimal_places=2)
    expected_interest = models.DecimalField(max_digits=14, decimal_places=2)
    expected_total = models.DecimalField(max_digits=14, decimal_places=2)

    actual_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_paid = models.BooleanField(default=False)
    days_overdue = models.IntegerField(default=0)
    paid_date = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "core_mfidisbursementrepayment"
        ordering = ["disbursement", "installment_number"]
        unique_together = ["disbursement", "installment_number"]
        indexes = [
            models.Index(fields=["due_date", "is_paid"]),
            models.Index(fields=["days_overdue"]),
        ]

    def __str__(self) -> str:
        return f"{self.disbursement} - Installment {self.installment_number}"

    def save(self, *args, **kwargs):
        actual_paid = Decimal(str(self.actual_paid or "0"))
        expected_total = Decimal(str(self.expected_total or "0"))

        if actual_paid >= expected_total:
            self.is_paid = True
            if not self.paid_date:
                self.paid_date = timezone.now().date()

        if self.is_paid:
            self.days_overdue = 0
        elif self.due_date:
            self.days_overdue = max((timezone.now().date() - self.due_date).days, 0)

        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return self.days_overdue > 0 and not self.is_paid

    @property
    def remaining_amount(self):
        return self.expected_total - self.actual_paid
