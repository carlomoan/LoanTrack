"""
Repairs MFIs whose tenant schema was never fully set up -- the
retroactive fix for two bugs that existed before this command:

1. Nothing ever created a Domain record when an MFI was onboarded, so
   the MFI was unreachable via X-Tenant-Subdomain forever (every
   tenant-scoped write -- Region, Branch, Member, Loan -- failed).
2. A signal race condition meant default tenant data (Region, Branch,
   etc.) never actually got seeded, and in at least one case an MFI's
   schema was never migrated at all (its tables don't exist).

Both are fixed going forward for newly onboarded MFIs (see
core/signals.py and MFIViewSet.perform_create). This command repairs
MFIs that were created before that fix, or whose setup was interrupted
partway through for any other reason. Safe to run repeatedly and safe
to run against MFIs that already work correctly -- every step here is
idempotent (schema creation checks for an existing schema first,
migrations are themselves idempotent, and default data uses
get_or_create so it never touches real data you've already entered).
"""

from django.core.management.base import BaseCommand
from django_tenants.utils import get_public_schema_name, schema_exists

from core.models import MFI, Domain
from core.signals import create_default_domain, initialize_tenant_defaults


class Command(BaseCommand):
    help = "Repairs MFIs missing a Domain record, an un-migrated schema, or default tenant data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--mfi-id",
            type=int,
            default=None,
            help="Repair only this one MFI (by id) instead of every MFI.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be repaired without changing anything.",
        )

    def handle(self, *args, **options):
        mfi_id = options["mfi_id"]
        dry_run = options["dry_run"]

        queryset = MFI.objects.exclude(schema_name=get_public_schema_name())
        if mfi_id is not None:
            queryset = queryset.filter(id=mfi_id)

        if not queryset.exists():
            self.stdout.write(self.style.WARNING("No matching MFIs found."))
            return

        for mfi in queryset:
            self.stdout.write(f"\n--- {mfi.name} ({mfi.schema_name}) ---")

            schema_ok = schema_exists(mfi.schema_name)
            has_domain = Domain.objects.filter(tenant=mfi).exists()

            if schema_ok and has_domain:
                self.stdout.write("  Schema and domain already OK.")
            else:
                if not schema_ok:
                    self.stdout.write(
                        self.style.WARNING(
                            "  Schema was never created/migrated."
                        )
                    )
                if not has_domain:
                    self.stdout.write(
                        self.style.WARNING("  Missing Domain record.")
                    )

            if dry_run:
                self.stdout.write("  (dry run -- no changes made)")
                continue

            try:
                if not schema_ok:
                    mfi.create_schema(check_if_exists=True, verbosity=0)
                    self.stdout.write(self.style.SUCCESS("  Schema created and migrated."))

                if not has_domain:
                    domain = create_default_domain(mfi)
                    self.stdout.write(
                        self.style.SUCCESS(f"  Domain created: {domain.domain}")
                    )

                initialize_tenant_defaults(mfi)
                self.stdout.write(self.style.SUCCESS("  Default tenant data ensured."))

            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"  Failed to repair: {exc}"))

        self.stdout.write(self.style.SUCCESS("\nDone."))
