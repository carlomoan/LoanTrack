from rest_framework import serializers

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

    class Meta:
        model = AoM
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


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
