from decimal import Decimal

from django.db import connection, models
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from simple_history.models import HistoricalRecords


# =============================================================================
# Tenant-aware upload path
# Must be a module-level deconstructible class so Django can serialize it
# in migrations.
# =============================================================================


@deconstructible
class TenantUploadPath:
    """
    Generates tenant-aware upload paths.

    Example:
        tenants/mfi_one/loan_documents/file.pdf
    """

    def __init__(self, subfolder: str):
        self.subfolder = subfolder

    def __call__(self, instance, filename):
        schema_name = getattr(connection, "schema_name", "public")
        return f"tenants/{schema_name}/{self.subfolder}/{filename}"


# =============================================================================
# Helpers
# =============================================================================


def generate_unique_field_value(
    instance,
    field_name: str,
    base_text: str,
    max_length: int = 20,
) -> str:
    """
    Generates a unique code-like field value.
    """

    base = "".join(
        c.upper() for c in (base_text or "") if c.isalnum()
    ).strip()

    if not base:
        base = "CODE"

    base = base[:max_length]

    queryset = instance.__class__.objects.all()

    if instance.pk:
        queryset = queryset.exclude(pk=instance.pk)

    candidate = base
    counter = 1

    while queryset.filter(**{field_name: candidate}).exists():
        suffix = str(counter)
        candidate = f"{base[:max_length - len(suffix)]}{suffix}"
        counter += 1

    return candidate


# =============================================================================
# Normalized Geography Models
# Region -> District -> Ward -> Street
# =============================================================================


class Region(models.Model):
    """
    Top-level geographic region.
    """

    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=20, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_region"
        ordering = ["name"]

    def __str__(self) -> str:
        return str(self.name)

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_field_value(
                self,
                "code",
                self.name,
                20,
            )

        super().save(*args, **kwargs)


class District(models.Model):
    """
    District within a region.
    """

    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="districts",
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_district"
        ordering = ["name"]
        unique_together = ["region", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.region.name})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_field_value(
                self,
                "code",
                self.name,
                20,
            )

        super().save(*args, **kwargs)


class Ward(models.Model):
    """
    Ward within a district.
    """

    class GeoType(models.TextChoices):
        URBAN = "URB", "Urban"
        RURAL = "RUR", "Rural"
        PERI_URBAN = "PER", "Peri-Urban"

    district = models.ForeignKey(
        District,
        on_delete=models.CASCADE,
        related_name="wards",
    )

    name = models.CharField(max_length=255)

    geo_type = models.CharField(
        max_length=50,
        choices=GeoType.choices,
        default=GeoType.URBAN,
    )

    code = models.CharField(max_length=20, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_ward"
        ordering = ["name"]
        unique_together = ["district", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.district.name})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_field_value(
                self,
                "code",
                self.name,
                20,
            )

        super().save(*args, **kwargs)


class Street(models.Model):
    """
    Street within a ward.
    """

    ward = models.ForeignKey(
        Ward,
        on_delete=models.CASCADE,
        related_name="streets",
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_street"
        ordering = ["name"]
        unique_together = ["ward", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.ward.name})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_field_value(
                self,
                "code",
                self.name,
                20,
            )

        super().save(*args, **kwargs)


# =============================================================================
# Core Tenant Models
# =============================================================================


class Branch(models.Model):
    """
    MFI Branch - isolated per tenant schema.
    """

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)

    street = models.ForeignKey(
        Street,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="branches",
    )

    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    manager_name = models.CharField(max_length=255, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_branch"
        ordering = ["name"]

    def __str__(self):
        return str(self.name)

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_field_value(
                self,
                "code",
                self.name,
                20,
            )

        super().save(*args, **kwargs)


class LoanOfficer(models.Model):
    """
    Loan Officer - isolated per tenant schema.
    """

    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)

    employee_id = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loan_officers",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_loanofficer"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = generate_unique_field_value(
                self,
                "employee_id",
                self.name,
                50,
            )

        super().save(*args, **kwargs)


class Member(models.Model):
    """
    Borrower/Member - isolated per tenant schema.
    """

    class GenderChoices(models.TextChoices):
        MALE = "M", "Male"
        FEMALE = "F", "Female"
        OTHER = "O", "Other"

    class BorrowerType(models.TextChoices):
        INDIVIDUAL = "IND", "Individual"
        GROUP = "GRP", "Group"

    member_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)

    gender = models.CharField(
        max_length=1,
        choices=GenderChoices.choices,
    )

    borrower_type = models.CharField(
        max_length=3,
        choices=BorrowerType.choices,
        default=BorrowerType.INDIVIDUAL,
    )

    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    national_id = models.CharField(max_length=50, blank=True)

    street = models.ForeignKey(
        Street,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )

    # Legacy fields for CSV import compatibility
    region_1 = models.CharField(max_length=255, blank=True)
    region_2 = models.CharField(max_length=255, blank=True)
    ward = models.CharField(max_length=255, blank=True)
    street_name = models.CharField(max_length=255, blank=True)
    geo_type = models.CharField(max_length=100, blank=True)

    beneficiaries = models.IntegerField(default=1)

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )

    loan_officer = models.ForeignKey(
        LoanOfficer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )

    is_active = models.BooleanField(default=True)
    joined_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_member"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name", "region_1", "region_2"]),
            models.Index(fields=["member_id"]),
            models.Index(fields=["street"]),
        ]

    def __str__(self):
        return f"{self.member_id} - {self.name}"

    @property
    def full_address(self):
        """
        Get full address from normalized geography.
        Falls back to legacy fields when normalized street is missing.
        """

        if self.street_id:
            parts = [str(self.street.name)]

            if self.street.ward:
                parts.append(str(self.street.ward.name))

            if self.street.ward and self.street.ward.district:
                parts.append(str(self.street.ward.district.name))

            if (
                self.street.ward
                and self.street.ward.district
                and self.street.ward.district.region
            ):
                parts.append(str(self.street.ward.district.region.name))

            return ", ".join(parts)

        parts = [
            p
            for p in [
                self.street_name,
                self.ward,
                self.region_2,
                self.region_1,
            ]
            if p
        ]

        return ", ".join(parts) if parts else ""


class SoftDeletionManager(models.Manager):
    """
    Manager that filters out soft-deleted loans.
    """

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class Loan(models.Model):
    """
    Loan - isolated per tenant schema.
    """

    class LoanStatus(models.TextChoices):
        ACTIVE = "ACT", "Active"
        CLOSED = "CLS", "Closed"
        DEFAULTED = "DEF", "Defaulted"
        PENDING = "PND", "Pending"

    loan_number = models.CharField(max_length=50, unique=True, blank=True)

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="loans",
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loans",
    )

    loan_officer = models.ForeignKey(
        LoanOfficer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loans",
    )

    product_type = models.CharField(max_length=100)
    disbursement_date = models.DateField()

    status = models.CharField(
        max_length=3,
        choices=LoanStatus.choices,
        default=LoanStatus.PENDING,
    )

    water_component = models.BooleanField(default=False)

    interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    loan_term = models.IntegerField()

    loan_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    repaid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    outstanding_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    last_report_date = models.DateField(null=True, blank=True)

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    objects = SoftDeletionManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "tenants_loan"
        ordering = ["-disbursement_date"]
        indexes = [
            models.Index(fields=["loan_number"]),
            models.Index(fields=["status"]),
            models.Index(fields=["member", "status"]),
            models.Index(fields=["is_deleted"]),
        ]

    def __str__(self):
        return f"{self.loan_number} - {self.member.name}"

    def _generate_loan_number(self) -> str:
        """
        Format: {first 3 letters of MFI name, uppercase}{YY}{MM}{DD}-{3-digit counter}
        e.g. "Public" on 2026-08-17 -> "PUB260817-001"

        The counter resets daily (it counts existing loans whose number
        already starts with today's prefix), since the date is already
        encoded in the prefix -- a loan numbered -001 tomorrow doesn't
        collide with today's -001.
        """
        from django.db import connection

        # connection.tenant is only the *full* MFI row when set via real
        # HTTP middleware (connection.set_tenant(mfi_instance)). Code
        # that instead uses schema_context() -- shell scripts, CSV
        # import, cross-tenant report generation, tests -- gets a
        # lightweight FakeTenant that only carries schema_name, not
        # name/aom/etc. Looking the MFI up by schema_name works
        # correctly either way.
        from core.models import MFI as MFIModel

        mfi = MFIModel.objects.filter(
            schema_name=connection.schema_name
        ).only("name").first()
        mfi_name = mfi.name if mfi else ""

        name_letters = "".join(c for c in mfi_name if c.isalnum())
        prefix_letters = (name_letters[:3] or "MFI").upper().ljust(3, "X")

        today = timezone.now().date()
        date_part = today.strftime("%y%m%d")
        prefix = f"{prefix_letters}{date_part}"

        existing_count = Loan.all_objects.filter(
            loan_number__startswith=f"{prefix}-"
        ).count()

        counter = existing_count + 1
        candidate = f"{prefix}-{counter:03d}"

        # Defends against a rare race (two loans saved concurrently on
        # the same day landing on the same count) rather than relying on
        # the count alone -- same pattern used for Region/District codes
        # elsewhere in this app.
        while Loan.all_objects.filter(loan_number=candidate).exists():
            counter += 1
            candidate = f"{prefix}-{counter:03d}"

        return candidate

    def save(self, *args, **kwargs):
        if not self.loan_number:
            self.loan_number = self._generate_loan_number()

        loan_amount = Decimal(str(self.loan_amount or "0"))
        repaid_amount = Decimal(str(self.repaid_amount or "0"))

        outstanding = loan_amount - repaid_amount

        self.outstanding_amount = max(Decimal("0.00"), outstanding)

        super().save(*args, **kwargs)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at"])


# =============================================================================
# Repayment Schedule
# =============================================================================


class RepaymentSchedule(models.Model):
    """
    Expected repayment schedule for a loan.
    """

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="schedule",
    )

    installment_number = models.IntegerField()
    due_date = models.DateField()

    expected_principal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    expected_interest = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    expected_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    actual_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    is_paid = models.BooleanField(default=False)
    days_overdue = models.IntegerField(default=0)
    paid_date = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_repaymentschedule"
        ordering = ["loan", "installment_number"]
        unique_together = ["loan", "installment_number"]
        indexes = [
            models.Index(fields=["due_date", "is_paid"]),
            models.Index(fields=["days_overdue"]),
        ]

    def __str__(self):
        return f"{self.loan.loan_number} - Installment {self.installment_number}"

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
            self.days_overdue = max(
                (timezone.now().date() - self.due_date).days,
                0,
            )

        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return self.days_overdue > 0 and not self.is_paid

    @property
    def remaining_amount(self):
        return self.expected_total - self.actual_paid


# =============================================================================
# Loan Adjustments
# =============================================================================


class LoanAdjustment(models.Model):
    """
    Manual adjustments to loan amounts with supporting documents.
    """

    class AdjustmentType(models.TextChoices):
        PRINCIPAL_REDUCTION = "PRD", "Principal Reduction"
        INTEREST_WAIVER = "INW", "Interest Waiver"
        WRITE_OFF = "WRO", "Write Off"
        PENALTY = "PEN", "Penalty"
        REVERSAL = "REV", "Reversal"
        OTHER = "OTH", "Other"

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="adjustments",
    )

    adjustment_type = models.CharField(
        max_length=3,
        choices=AdjustmentType.choices,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    reason = models.TextField()
    reference_number = models.CharField(max_length=100, blank=True)

    supporting_document = models.FileField(
        upload_to=TenantUploadPath("loan_adjustments"),
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        "core.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loan_adjustments",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    approved_by = models.ForeignKey(
        "core.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_adjustments",
    )

    approved_at = models.DateTimeField(null=True, blank=True)
    is_approved = models.BooleanField(default=False)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_loanadjustment"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.loan.loan_number} - "
            f"{self.get_adjustment_type_display()} - "
            f"{self.amount}"
        )


# =============================================================================
# Document Attachments
# =============================================================================


class LoanDocument(models.Model):
    """
    Document attachments for loans.
    """

    class DocumentType(models.TextChoices):
        RECEIPT = "RCT", "Receipt"
        AGREEMENT = "AGR", "Loan Agreement"
        ID_DOCUMENT = "IDD", "ID Document"
        COLLATERAL = "COL", "Collateral Document"
        OTHER = "OTH", "Other"

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    document_type = models.CharField(
        max_length=3,
        choices=DocumentType.choices,
    )

    file = models.FileField(
        upload_to=TenantUploadPath("loan_documents"),
    )

    description = models.TextField(blank=True)

    uploaded_by = models.ForeignKey(
        "core.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)

    history = HistoricalRecords()

    class Meta:
        db_table = "tenants_loandocument"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.loan.loan_number} - {self.get_document_type_display()}"
