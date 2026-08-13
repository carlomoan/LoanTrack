# setup_tenants.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'loantrack.settings')
django.setup()

from core.models import MFI, Domain

print("Setting up tenants...")

# 1. Create Public Tenant (Required for shared endpoints like login)
public_tenant, created = MFI.objects.get_or_create(
    schema_name='public',
    defaults={
        'name': 'Public',
        'code': 'PUBLIC',
        'registration_number': 'PUBLIC-001',
        'email': 'admin@localhost',
        'phone': '000',
        'address': 'Public schema',
        'is_active': True,
        'is_onboarded': True,
    }
)
if created:
    print("✅ Created Public Tenant")
Domain.objects.get_or_create(tenant=public_tenant, domain='localhost', defaults={'is_primary': True})

# 2. Create Test MFI Tenant (Required for /api/tenant/ endpoints)
mfi, created = MFI.objects.get_or_create(
    schema_name='tenant_testmfi',
    defaults={
        'name': 'Test MFI',
        'code': 'TESTMFI',
        'registration_number': 'TEST-001',
        'email': 'test@mfi.com',
        'phone': '111',
        'address': 'Test Address',
        'is_active': True,
        'is_onboarded': True,
    }
)
if created:
    print("✅ Created Test MFI Tenant (building schema...)")

# Map domains to the test MFI
Domain.objects.get_or_create(tenant=mfi, domain='testmfi.localhost', defaults={'is_primary': True})
Domain.objects.get_or_create(tenant=mfi, domain='testmfi', defaults={'is_primary': False})

print("🎉 Done! Tenants are ready.")
