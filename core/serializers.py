from rest_framework import serializers

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


class DonorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donor
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class AoMSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(
        source="donor.name",
        read_only=True,
        default=None,
    )

    mfi_count = serializers.IntegerField(read_only=True, default=0)

    # Ids of the MFIs under this AoM, so the disbursement form can limit
    # its MFI dropdown to valid choices instead of letting the user pick a
    # combination the backend will reject.
    mfi_ids = serializers.SerializerMethodField()

    donor_ids = serializers.SerializerMethodField()
    donor_names = serializers.SerializerMethodField()

    class Meta:
        model = AoM
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_mfi_ids(self, obj):
        return list(obj.mfis.values_list("id", flat=True))

    def get_donor_ids(self, obj):
        return list(obj.donors.values_list("id", flat=True))

    def get_donor_names(self, obj):
        return list(obj.donors.values_list("name", flat=True))


class DomainSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(
        source="tenant.name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = Domain
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class MFIReportSerializer(serializers.ModelSerializer):
    mfi_name = serializers.CharField(source="mfi.name", read_only=True)

    generated_by_name = serializers.CharField(
        source="generated_by.get_full_name",
        read_only=True,
        default=None,
    )

    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = MFIReport
        fields = "__all__"
        read_only_fields = [
            "id",
            "generated_at",
            "generated_by",
            "submitted_at",
            "approved_by",
            "approved_at",
        ]


class AoMReportSerializer(serializers.ModelSerializer):
    aom_name = serializers.CharField(source="aom.name", read_only=True)

    generated_by_name = serializers.CharField(
        source="generated_by.get_full_name",
        read_only=True,
        default=None,
    )

    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AoMReport
        fields = "__all__"
        read_only_fields = [
            "id",
            "generated_at",
            "generated_by",
            "approved_by",
            "approved_at",
        ]


class DonorReportSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)

    generated_by_name = serializers.CharField(
        source="generated_by.get_full_name",
        read_only=True,
        default=None,
    )

    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = DonorReport
        fields = "__all__"
        read_only_fields = [
            "id",
            "generated_at",
            "generated_by",
            "approved_by",
            "approved_at",
        ]


class MFIListSerializer(serializers.ModelSerializer):
    aom_name = serializers.CharField(
        source="aom.name",
        read_only=True,
        default=None,
    )

    donor_name = serializers.CharField(
        source="donor.name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = MFI
        fields = [
            "id",
            "name",
            "code",
            "schema_name",
            "registration_number",
            "license_number",
            "email",
            "phone",
            "address",
            "local_currency",
            "aom",
            "aom_name",
            "donor",
            "donor_name",
            "is_active",
            "is_onboarded",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "code",
            "schema_name",
            "created_at",
            "updated_at",
        ]


class MFIDetailSerializer(MFIListSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    reports = serializers.SerializerMethodField()

    class Meta(MFIListSerializer.Meta):
        fields = "__all__"

    def get_reports(self, obj):
        return MFIReportSerializer(obj.reports.all()[:12], many=True).data


class GlobalUserSerializer(serializers.ModelSerializer):
    aom_name = serializers.CharField(
        source="aom.name",
        read_only=True,
        default=None,
    )

    donor_name = serializers.CharField(
        source="donor.name",
        read_only=True,
        default=None,
    )

    mfi_name = serializers.CharField(
        source="mfi.name",
        read_only=True,
        default=None,
    )

    mfi_schema = serializers.CharField(
        source="mfi.schema_name",
        read_only=True,
        default=None,
    )

    mfi_code = serializers.CharField(
        source="mfi.code",
        read_only=True,
        default=None,
    )

    class Meta:
        model = GlobalUser
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "aom",
            "aom_name",
            "donor",
            "donor_name",
            "mfi",
            "mfi_name",
            "mfi_schema",
            "mfi_code",
            "is_staff",
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "last_login",
        ]
        extra_kwargs = {
            "password": {
                "write_only": True,
                "required": False,
            }
        }

    # Fields that change what an account can do or where it belongs.
    # Never settable through self-edit, and only settable on someone else
    # within the limits of ASSIGNABLE_ROLES below.
    PRIVILEGE_FIELDS = {"role", "is_staff", "is_active", "aom", "donor", "mfi"}

    # Mirrors the frontend's assignableRoles() in lib/permissions.ts --
    # keep both in sync. This is the actual security boundary; the
    # frontend list is just UI convenience for hiding options that would
    # be rejected here anyway.
    ASSIGNABLE_ROLES = {
        "SUPER_ADMIN": {
            "SUPER_ADMIN", "AOM_STAFF", "DONOR_STAFF",
            "MFI_ADMIN", "MFI_MANAGER", "LOAN_OFFICER",
        },
        "AOM_STAFF": {"MFI_ADMIN", "MFI_MANAGER", "LOAN_OFFICER"},
        "MFI_ADMIN": {"MFI_MANAGER", "LOAN_OFFICER"},
    }

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None or not getattr(request.user, "is_authenticated", False):
            return attrs

        requester = request.user
        requester_role = getattr(requester, "role", None)
        touched_privilege_fields = self.PRIVILEGE_FIELDS & set(attrs.keys())

        # Editing your own account: no privilege field may move, no
        # matter who you are. A SUPER_ADMIN changing their own role is a
        # rare enough case that it belongs in the Django admin, not a
        # self-service endpoint that every role can reach.
        if self.instance is not None and self.instance.id == requester.id:
            if touched_privilege_fields:
                raise serializers.ValidationError(
                    "You cannot change your own role, status, or "
                    "organization assignment through this endpoint."
                )
            return attrs

        # Creating a new account, or editing someone else's: the target
        # role must be one this requester is actually allowed to grant.
        target_role = attrs.get("role") or getattr(self.instance, "role", None)
        allowed_roles = self.ASSIGNABLE_ROLES.get(requester_role, set())

        if target_role and target_role not in allowed_roles:
            raise serializers.ValidationError(
                {"role": f"You are not authorized to assign the role {target_role}."}
            )

        # An AOM_STAFF or MFI_ADMIN delegating a role must delegate it
        # within their own organization -- not hand out access to some
        # other AoM's MFI, or grant aom/donor-level access at all (that's
        # SUPER_ADMIN's call).
        if requester_role == "AOM_STAFF":
            if attrs.get("aom") or attrs.get("donor"):
                raise serializers.ValidationError(
                    "AoM staff can only assign MFI-level roles, not AoM or donor access."
                )
            target_mfi = attrs.get("mfi") or getattr(self.instance, "mfi", None)
            if not target_mfi or target_mfi.aom_id != requester.aom_id:
                raise serializers.ValidationError(
                    {"mfi": "You can only assign users to an MFI within your own AoM."}
                )

        if requester_role == "MFI_ADMIN":
            if attrs.get("aom") or attrs.get("donor"):
                raise serializers.ValidationError(
                    "You are not authorized to assign AoM or donor access."
                )
            target_mfi = attrs.get("mfi") or getattr(self.instance, "mfi", None)
            if not target_mfi or target_mfi.id != requester.mfi_id:
                raise serializers.ValidationError(
                    {"mfi": "You can only assign users to your own MFI."}
                )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = GlobalUser.objects.create_user(password=password, **validated_data)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)

        if password:
            user.set_password(password)
            user.save(update_fields=["password"])

        return user


# =============================================================================
# Fund flow: Donor -> AoM -> MFI
# =============================================================================


class DonorContributionSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)
    aom_name = serializers.CharField(source="aom.name", read_only=True)

    recorded_by_name = serializers.CharField(
        source="recorded_by.get_full_name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = DonorContribution
        fields = "__all__"
        read_only_fields = ["id", "recorded_by", "created_at", "updated_at"]

    def validate(self, attrs):
        donor = attrs.get("donor") or getattr(self.instance, "donor", None)
        aom = attrs.get("aom") or getattr(self.instance, "aom", None)
        if donor and aom and not aom.donors.filter(id=donor.id).exists():
            raise serializers.ValidationError(
                "This donor does not fund the selected AoM."
            )
        return attrs


class MFIDisbursementRepaymentSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = MFIDisbursementRepayment
        fields = "__all__"
        read_only_fields = [
            "id",
            "disbursement",
            "installment_number",
            "expected_principal",
            "expected_interest",
            "expected_total",
            "is_paid",
            "days_overdue",
        ]


class MFIDisbursementSerializer(serializers.ModelSerializer):
    aom_name = serializers.CharField(source="aom.name", read_only=True)
    mfi_name = serializers.CharField(source="mfi.name", read_only=True)

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = MFIDisbursement
        fields = "__all__"
        read_only_fields = [
            "id",
            "repaid_amount",
            "outstanding_amount",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        aom = attrs.get("aom") or getattr(self.instance, "aom", None)
        mfi = attrs.get("mfi") or getattr(self.instance, "mfi", None)
        if aom and mfi and mfi.aom_id != aom.id:
            raise serializers.ValidationError(
                "This MFI does not belong to the selected AoM."
            )
        return attrs


class MFIDisbursementDetailSerializer(MFIDisbursementSerializer):
    schedule = MFIDisbursementRepaymentSerializer(many=True, read_only=True)
