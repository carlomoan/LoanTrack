"""
Tenant isolation tests.

These exist specifically to prove the authorization fix in
`TenantViewSetMixin._check_tenant_membership`: a user authenticated
against one MFI must not be able to read or write another MFI's
tenant-schema data just by sending a different `X-Tenant-Subdomain`
header.

Uses TransactionTestCase (not TestCase) because creating an MFI triggers
real `CREATE SCHEMA` / schema-migration DDL via django-tenants, which
needs to be visible outside the test's own transaction.
"""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import AoM, Domain, Donor, MFI

User = get_user_model()


class TenantIsolationTests(TransactionTestCase):
    def setUp(self):
        # The previous test's requests left this connection's search_path
        # pointed at whatever tenant schema it last resolved to (set via
        # connection.set_tenant() in the middleware). Reset before doing
        # any public-schema work of our own.
        connection.set_schema_to_public()

        # Unique suffix per test method: TransactionTestCase's automatic
        # flush-between-tests doesn't cleanly reset django-tenants' public
        # schema state here, so reused names/codes collide across tests.
        suffix = self._testMethodName[-20:]

        # Needed so the "no X-Tenant-Subdomain header" test hits
        # TenantViewSetMixin's intended 400 response rather than a raw
        # 404 from the middleware failing to find *any* public tenant.
        self.public_tenant = MFI.objects.filter(schema_name="public").first()
        if self.public_tenant is None:
            self.public_tenant = MFI(
                schema_name="public",
                name="Public",
                code="PUBLIC",
                registration_number="PUBLIC-001",
                email="admin@localhost",
                phone="000",
                address="Public schema",
            )
            self.public_tenant.auto_create_schema = False
            self.public_tenant.save()
        Domain.objects.get_or_create(
            tenant=self.public_tenant,
            domain="testserver",
            defaults={"is_primary": True},
        )

        self.donor = Donor.objects.create(
            name=f"Test Donor {suffix}",
            contact_email="donor@example.com",
        )
        self.aom = AoM.objects.create(
            name=f"Test AoM {suffix}",
            code=f"TAOM{suffix}"[:20],
            donor=self.donor,
            contact_email="aom@example.com",
        )

        self.mfi_a = MFI(
            name=f"MFI Alpha {suffix}",
            registration_number=f"REG-ALPHA-{suffix}",
            email="alpha@example.com",
            phone="000",
            address="addr",
            aom=self.aom,
        )
        self.mfi_a.save()
        Domain.objects.create(
            tenant=self.mfi_a,
            domain=self.mfi_a.schema_name,
            is_primary=True,
        )

        self.mfi_b = MFI(
            name=f"MFI Beta {suffix}",
            registration_number=f"REG-BETA-{suffix}",
            email="beta@example.com",
            phone="000",
            address="addr",
            aom=self.aom,
        )
        self.mfi_b.save()
        Domain.objects.create(
            tenant=self.mfi_b,
            domain=self.mfi_b.schema_name,
            is_primary=True,
        )

        self.officer_a = User.objects.create_user(
            username=f"officer_a_{suffix}",
            password="pw",
            role=User.Role.LOAN_OFFICER,
            mfi=self.mfi_a,
        )
        self.admin_a = User.objects.create_user(
            username=f"admin_a_{suffix}",
            password="pw",
            role=User.Role.MFI_ADMIN,
            mfi=self.mfi_a,
        )
        self.aom_staff = User.objects.create_user(
            username=f"aom_staff_{suffix}",
            password="pw",
            role=User.Role.AOM_STAFF,
            aom=self.aom,
        )
        self.super_admin = User.objects.create_user(
            username=f"super_{suffix}",
            password="pw",
            role=User.Role.SUPER_ADMIN,
        )

    def tearDown(self):
        connection.set_schema_to_public()
        self.mfi_a.delete(force_drop=True)
        self.mfi_b.delete(force_drop=True)

    def _client_for(self, user, tenant_subdomain):
        client = APIClient()
        client.force_authenticate(user=user)
        client.credentials(HTTP_X_TENANT_SUBDOMAIN=tenant_subdomain)
        return client

    # --- The core exploit this whole suite exists to close -------------

    def test_loan_officer_cannot_read_other_mfis_members(self):
        client = self._client_for(self.officer_a, self.mfi_b.schema_name)
        response = client.get("/api/tenant/members/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_loan_officer_cannot_read_other_mfis_loans(self):
        client = self._client_for(self.officer_a, self.mfi_b.schema_name)
        response = client.get("/api/tenant/loans/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mfi_admin_cannot_write_to_other_mfi(self):
        client = self._client_for(self.admin_a, self.mfi_b.schema_name)
        response = client.post(
            "/api/tenant/branches/",
            {"name": "Injected Branch", "code": "HACK"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- Legitimate access still works ----------------------------------

    def test_loan_officer_can_read_own_mfis_members(self):
        client = self._client_for(self.officer_a, self.mfi_a.schema_name)
        response = client.get("/api/tenant/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mfi_admin_can_write_to_own_mfi(self):
        client = self._client_for(self.admin_a, self.mfi_a.schema_name)
        response = client.post(
            "/api/tenant/branches/",
            {"name": "Head Office", "code": "HQ"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_super_admin_can_read_any_mfi(self):
        client = self._client_for(self.super_admin, self.mfi_b.schema_name)
        response = client.get("/api/tenant/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- Loan officers are read/write but not destructive ---------------

    def test_loan_officer_cannot_delete_even_within_own_mfi(self):
        admin_client = self._client_for(self.admin_a, self.mfi_a.schema_name)
        created = admin_client.post(
            "/api/tenant/branches/",
            {"name": "Branch To Delete", "code": "DEL1"},
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        branch_id = created.data["id"]

        officer_client = self._client_for(self.officer_a, self.mfi_a.schema_name)
        response = officer_client.delete(f"/api/tenant/branches/{branch_id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- AoM staff have no direct access to tenant data at all --------

    def test_aom_staff_cannot_read_or_write_own_aoms_mfi_tenant_data(self):
        # Corrected rule: AoM oversight goes through MFIReport and
        # MFIDisbursement (both public-schema), never direct read access
        # to an MFI's individual member/loan records -- not even for the
        # AoM that funds it.
        client = self._client_for(self.aom_staff, self.mfi_a.schema_name)
        read_response = client.get("/api/tenant/members/")
        self.assertEqual(read_response.status_code, status.HTTP_403_FORBIDDEN)

        write_response = client.post(
            "/api/tenant/branches/",
            {"name": "AoM Injected Branch", "code": "HACK2"},
        )
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_tenant_header_falls_back_to_public_and_is_rejected(self):
        client = APIClient()
        client.force_authenticate(user=self.officer_a)
        response = client.get("/api/tenant/members/")
        self.assertIn(
            response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN),
        )

    def test_unresolvable_tenant_header_falls_back_to_public_not_404(self):
        # Regression test: a stale/wrong X-Tenant-Subdomain header (e.g.
        # from a frontend that shouldn't have sent one at all for a
        # shared endpoint) must not hard-404 the request. It should
        # behave exactly like no header was sent -- falling back to the
        # public schema -- so shared endpoints keep working regardless.
        client = APIClient()
        client.force_authenticate(user=self.officer_a)
        client.credentials(HTTP_X_TENANT_SUBDOMAIN="this-schema-does-not-exist")
        response = client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unresolvable_tenant_header_on_tenant_endpoint_gives_clear_400_not_404(self):
        client = APIClient()
        client.force_authenticate(user=self.officer_a)
        client.credentials(HTTP_X_TENANT_SUBDOMAIN="this-schema-does-not-exist")
        response = client.get("/api/tenant/members/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CrossTenantReportScopingTests(TransactionTestCase):
    """
    The cross-tenant reporting endpoints intentionally read across tenant
    lines, so tenant-schema isolation alone doesn't protect them -- each
    action has to check the caller's own organizational scope. These
    tests prove that check exists.
    """

    def setUp(self):
        connection.set_schema_to_public()
        suffix = self._testMethodName[-20:]

        # These requests carry no X-Tenant-Subdomain header, so
        # TenantHeaderMiddleware falls back to hostname-based lookup
        # (which won't match the test client's "testserver" host) and
        # then to the public-schema tenant. That row must exist.
        self.public_tenant = MFI.objects.filter(schema_name="public").first()
        if self.public_tenant is None:
            self.public_tenant = MFI(
                schema_name="public",
                name="Public",
                code="PUBLIC",
                registration_number="PUBLIC-001",
                email="admin@localhost",
                phone="000",
                address="Public schema",
            )
            self.public_tenant.auto_create_schema = False
            self.public_tenant.save()
        Domain.objects.get_or_create(
            tenant=self.public_tenant,
            domain="testserver",
            defaults={"is_primary": True},
        )

        self.donor = Donor.objects.create(
            name=f"Test Donor {suffix}", contact_email="donor@example.com"
        )
        self.aom_1 = AoM.objects.create(
            name=f"AoM One {suffix}",
            code=f"AOM1{suffix}"[:20],
            donor=self.donor,
            contact_email="a1@example.com",
        )
        self.aom_2 = AoM.objects.create(
            name=f"AoM Two {suffix}",
            code=f"AOM2{suffix}"[:20],
            donor=self.donor,
            contact_email="a2@example.com",
        )

        self.aom_1_staff = User.objects.create_user(
            username=f"aom1_staff_{suffix}",
            password="pw",
            role=User.Role.AOM_STAFF,
            aom=self.aom_1,
        )

    def test_aom_staff_cannot_generate_report_for_a_different_aom(self):
        client = APIClient()
        client.force_authenticate(user=self.aom_1_staff)

        response = client.post(
            "/api/tenant/public/cross-tenant/generate_aom_report/",
            {"aom_id": self.aom_2.id, "period": "2026-08"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_aom_staff_mfi_reports_query_is_scoped_to_own_aom(self):
        client = APIClient()
        client.force_authenticate(user=self.aom_1_staff)

        # Even without filters, and even if the caller asks for another
        # AoM's id explicitly, results must never include aom_2's data.
        response = client.get(
            "/api/tenant/public/cross-tenant/mfi_reports/",
            {"aom": self.aom_2.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
