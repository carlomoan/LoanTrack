import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django_tenants.utils import get_public_schema_name, schema_context

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


def create_default_domain(instance: MFI):
    """
    Registers the domain the frontend's X-Tenant-Subdomain header (or a
    real hostname, in production) resolves to this MFI's schema through.

    Without this, an MFI is created and its schema exists, but nothing
    can ever route a request to it -- every tenant-scoped write (Region,
    Branch, Member, Loan, all of it) fails, because
    TenantHeaderMiddleware has no Domain row to match the header against
    and falls back to the public schema, where TenantViewSetMixin
    correctly (but unhelpfully, from the user's side) rejects it as "not
    an MFI tenant context".
    """
    from .models import Domain

    domain, created = Domain.objects.get_or_create(
        tenant=instance,
        domain=instance.schema_name,
        defaults={"is_primary": True},
    )
    if created:
        logger.info(
            f"Created domain '{domain.domain}' for tenant: {instance.schema_name}"
        )
    return domain


def initialize_tenant_defaults(instance: MFI):
    """
    Initializes default tenant data inside the tenant schema (default
    region/district/ward/street/branch/loan officer) plus the
    public-schema admin user and domain.

    Callers MUST ensure the tenant's schema already exists (i.e. call
    this after MFI.save() has fully returned, not from within a
    post_save signal on MFI -- see setup_new_tenant below for why that
    ordering matters).
    """

    from tenants.models import (
        Branch,
        District,
        LoanOfficer,
        Region,
        Street,
        Ward,
    )

    create_default_admin_user(instance)
    create_default_domain(instance)

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
    Runs on every MFI save, including the very first one that creates
    it. Deliberately does ONLY public-schema-safe work here (admin user,
    domain) -- both are unconditionally safe regardless of whether the
    tenant's own schema exists yet.

    It must NOT attempt anything inside the tenant's own schema
    (Region/Branch/etc.): TenantMixin.save() calls super().save() --
    which is what fires this signal -- BEFORE it calls
    self.create_schema(). That means this signal always runs while the
    new tenant's schema and tables do not exist yet, so any attempt to
    touch them here fails every time, not intermittently. The
    tenant-schema seeding happens explicitly in MFIViewSet.perform_create
    (and the create_schema/initialize_tenant actions), which run after
    MFI.save() has fully returned and the schema is guaranteed to exist.
    """

    if instance.schema_name == get_public_schema_name():
        return

    if not created or kwargs.get("raw", False):
        return

    if not getattr(instance, "auto_create_schema", False):
        return

    try:
        create_default_admin_user(instance)
        create_default_domain(instance)
    except Exception:
        logger.exception(
            f"Failed to create default admin user/domain for tenant: {instance.schema_name}"
        )
