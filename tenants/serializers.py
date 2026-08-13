from rest_framework import serializers

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


# =============================================================================
# Geography Serializers
# =============================================================================


class RegionSerializer(serializers.ModelSerializer):
    district_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Region
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class DistrictSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True, default=None)
    ward_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = District
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class WardSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name", read_only=True, default=None)
    region_name = serializers.CharField(
        source="district.region.name",
        read_only=True,
        default=None,
    )
    street_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Ward
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class StreetSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source="ward.name", read_only=True, default=None)
    district_name = serializers.CharField(
        source="ward.district.name",
        read_only=True,
        default=None,
    )
    region_name = serializers.CharField(
        source="ward.district.region.name",
        read_only=True,
        default=None,
    )

    member_count = serializers.IntegerField(read_only=True, default=0)
    branch_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Street
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


# =============================================================================
# Branch and Loan Officer Serializers
# =============================================================================


class BranchSerializer(serializers.ModelSerializer):
    street_name = serializers.CharField(source="street.name", read_only=True, default=None)
    ward_name = serializers.CharField(
        source="street.ward.name",
        read_only=True,
        default=None,
    )
    district_name = serializers.CharField(
        source="street.ward.district.name",
        read_only=True,
        default=None,
    )
    region_name = serializers.CharField(
        source="street.ward.district.region.name",
        read_only=True,
        default=None,
    )

    loan_officer_count = serializers.IntegerField(read_only=True, default=0)
    member_count = serializers.IntegerField(read_only=True, default=0)
    loan_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Branch
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class LoanOfficerSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)

    member_count = serializers.IntegerField(read_only=True, default=0)
    loan_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = LoanOfficer
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


# =============================================================================
# Member Serializer
# =============================================================================


class MemberSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    loan_officer_name = serializers.CharField(
        source="loan_officer.name",
        read_only=True,
        default=None,
    )

    street_name = serializers.CharField(source="street.name", read_only=True, default=None)
    ward_name = serializers.CharField(
        source="street.ward.name",
        read_only=True,
        default=None,
    )
    district_name = serializers.CharField(
        source="street.ward.district.name",
        read_only=True,
        default=None,
    )
    region_name = serializers.CharField(
        source="street.ward.district.region.name",
        read_only=True,
        default=None,
    )

    full_address = serializers.CharField(read_only=True)

    loan_count = serializers.IntegerField(read_only=True, default=0)
    total_loan_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
        default=0,
    )
    total_outstanding = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
        default=0,
    )

    class Meta:
        model = Member
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


# =============================================================================
# Repayment Schedule Serializer
# =============================================================================


class RepaymentScheduleSerializer(serializers.ModelSerializer):
    loan_number = serializers.CharField(source="loan.loan_number", read_only=True, default=None)
    member_name = serializers.CharField(source="loan.member.name", read_only=True, default=None)

    is_overdue = serializers.BooleanField(read_only=True)
    remaining_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = RepaymentSchedule
        fields = "__all__"
        read_only_fields = ["is_overdue", "remaining_amount"]


# =============================================================================
# Loan Adjustment Serializer
# =============================================================================


class LoanAdjustmentSerializer(serializers.ModelSerializer):
    loan_number = serializers.CharField(source="loan.loan_number", read_only=True, default=None)

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
        default=None,
    )

    approved_by_name = serializers.CharField(
        source="approved_by.get_full_name",
        read_only=True,
        default=None,
    )

    supporting_document_url = serializers.SerializerMethodField()

    class Meta:
        model = LoanAdjustment
        fields = "__all__"
        read_only_fields = [
            "created_at",
            "created_by",
            "approved_by",
            "approved_at",
            "is_approved",
        ]

    def get_supporting_document_url(self, obj):
        if not obj.supporting_document:
            return None

        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.supporting_document.url)

        return None


# =============================================================================
# Loan Document Serializer
# =============================================================================


class LoanDocumentSerializer(serializers.ModelSerializer):
    loan_number = serializers.CharField(source="loan.loan_number", read_only=True, default=None)

    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name",
        read_only=True,
        default=None,
    )

    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LoanDocument
        fields = "__all__"
        read_only_fields = ["uploaded_at", "uploaded_by"]

    def get_file_url(self, obj):
        if not obj.file:
            return None

        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.file.url)

        return None


# =============================================================================
# Loan Serializers
# =============================================================================


class LoanSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True, default=None)
    member_id = serializers.CharField(source="member.member_id", read_only=True, default=None)

    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    loan_officer_name = serializers.CharField(
        source="loan_officer.name",
        read_only=True,
        default=None,
    )

    outstanding_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    member_street = serializers.SerializerMethodField()
    member_ward = serializers.SerializerMethodField()
    member_district = serializers.SerializerMethodField()
    member_region = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "outstanding_amount"]

    def get_member_street(self, obj):
        try:
            if obj.member and obj.member.street:
                return obj.member.street.name
        except Exception:
            return None
        return None

    def get_member_ward(self, obj):
        try:
            if obj.member and obj.member.street and obj.member.street.ward:
                return obj.member.street.ward.name
        except Exception:
            return None
        return None

    def get_member_district(self, obj):
        try:
            if (
                obj.member
                and obj.member.street
                and obj.member.street.ward
                and obj.member.street.ward.district
            ):
                return obj.member.street.ward.district.name
        except Exception:
            return None
        return None

    def get_member_region(self, obj):
        try:
            if (
                obj.member
                and obj.member.street
                and obj.member.street.ward
                and obj.member.street.ward.district
                and obj.member.street.ward.district.region
            ):
                return obj.member.street.ward.district.region.name
        except Exception:
            return None
        return None


class LoanDetailSerializer(LoanSerializer):
    schedule = RepaymentScheduleSerializer(many=True, read_only=True)
    adjustments = LoanAdjustmentSerializer(many=True, read_only=True)
    documents = LoanDocumentSerializer(many=True, read_only=True)


class LoanHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for loan audit history records.
    """

    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = Loan.history.model
        fields = "__all__"

    def get_changed_by(self, obj):
        try:
            if obj.history_user:
                return obj.history_user.get_full_name()
        except Exception:
            return None
        return None
