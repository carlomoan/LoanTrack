import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django_tenants.utils import schema_context

from .models import MFI

logger = logging.getLogger(__name__)

User = get_user_model()


def create_default_admin_user(instance: MFI):
    """
    Creates a default MFI admin user in the shared/public user table.
    """

    username_base = (
        instance.code
        or instance.schema_name.replace("tenant_", "")
        or instance.name
    ).lower()

    username = "".join(
        c if c.isalnum() else "_" for c in username_base
    )[:150]

    if not username:
        username = "mfi_admin"

    email = f"admin@{instance.schema_name.replace('tenant_', '')}.local"

    if User.objects.filter(username=username).exists():
        logger.info(f"Admin user already exists for tenant: {instance.schema_name}")
        return

    User.objects.create_user(
        username=username,
        email=email,
        password="TempPassword123!",
        first_name="Admin",
        last_name=instance.name[:150],
        role=User.Role.MFI_ADMIN,
        mfi=instance,
        is_staff=True,
    )

    logger.info(
        f"Created default admin user '{username}' for tenant: {instance.schema_name}"
    )


def initialize_tenant_defaults(instance: MFI):
    """
    Initializes default tenant data inside the tenant schema.
    """

    from tenants.models import (
        Branch,
        District,
        LoanOfficer,
        Region,
        Street,
        Ward,
    )

    # Create shared/global admin user outside tenant schema context
    create_default_admin_user(instance)

    # Create tenant-specific default data
    with schema_context(instance.schema_name):
        region, _ = Region.objects.get_or_create(
            name="Default Region",
            defaults={"code": "DEFREG"},
        )

        district, _ = District.objects.get_or_create(
            region=region,
            name="Default District",
            defaults={"code": "DEFDIST"},
        )

        ward, _ = Ward.objects.get_or_create(
            district=district,
            name="Default Ward",
            defaults={
                "geo_type": Ward.GeoType.URBAN,
                "code": "DEFWARD",
            },
        )

        street, _ = Street.objects.get_or_create(
            ward=ward,
            name="Main Street",
            defaults={"code": "MAINST"},
        )

        branch, _ = Branch.objects.get_or_create(
            code="MAIN",
            defaults={
                "name": "Main Branch",
                "street": street,
                "manager_name": "Branch Manager",
            },
        )

        LoanOfficer.objects.get_or_create(
            employee_id="LO001",
            defaults={
                "name": "Default Loan Officer",
                "branch": branch,
            },
        )

        logger.info(
            f"Successfully initialized default data for tenant: {instance.schema_name}"
        )


@receiver(post_save, sender=MFI)
def setup_new_tenant(sender, instance: MFI, created: bool, **kwargs):
    """
    Handles MFI creation and initializes tenant defaults.
    """

    if not created or kwargs.get("raw", False):
        return

    if not getattr(instance, "auto_create_schema", False):
        return

    try:
        initialize_tenant_defaults(instance)
    except Exception as exc:
        logger.error(
            f"Failed to setup default data for tenant {instance.schema_name}: {exc}",
            exc_info=True,
        )
        from django_tenants.utils import get_public_schema_name

        @receiver(post_save, sender=MFI)
        def setup_new_tenant(sender, instance, created, **kwargs):
            # Skip initialization for the public schema — it doesn't have tenant tables
            if instance.schema_name == get_public_schema_name():
                return

            if created:
                initialize_tenant_defaults(instance)
