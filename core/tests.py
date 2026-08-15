"""
Authorization tests for the shared-schema endpoints in core/views.py.

Proves that GlobalUser.role actually restricts what a caller can see and
do on Donor / AoM / MFI / GlobalUser / report endpoints, instead of every
authenticated user seeing every organization's data.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import AoM, Domain, Donor, MFI, MFIDisbursement, MFIReport

User = get_user_model()


class SharedSchemaScopingTests(TestCase):
    def setUp(self):
        # core.middleware.TenantHeaderMiddleware falls back to this record
        # whenever a request carries no X-Tenant-Subdomain header (i.e.
        # every request to a /api/<shared>/ endpoint). It must exist for
        # any shared-schema view to resolve at all -- see setup_tenants.py.
        public_tenant = MFI(
            schema_name="public",
            name="Public",
            code="PUBLIC",
            registration_number="PUBLIC-001",
            email="admin@localhost",
            phone="000",
            address="Public schema",
        )
        public_tenant.auto_create_schema = False
        public_tenant.save()
        Domain.objects.create(
            tenant=public_tenant, domain="testserver", is_primary=True
        )

        self.donor_1 = Donor.objects.create(
            name="Donor One", contact_email="d1@example.com"
        )
        self.donor_2 = Donor.objects.create(
            name="Donor Two", contact_email="d2@example.com"
        )

        self.aom_1 = AoM.objects.create(
            name="AoM One", code="AOM1", donor=self.donor_1, contact_email="a1@example.com"
        )
        self.aom_2 = AoM.objects.create(
            name="AoM Two", code="AOM2", donor=self.donor_2, contact_email="a2@example.com"
        )

        # These tests only exercise the public-schema ViewSets, not tenant
        # data, so skip real CREATE SCHEMA / schema migration -- it isn't
        # needed here and doesn't play well with TestCase's wrapping
        # transaction.
        self.mfi_1 = MFI(
            name="MFI One",
            registration_number="REG-1",
            email="m1@example.com",
            phone="000",
            address="addr",
            aom=self.aom_1,
            schema_name="mfi_one_test",
            code="MFI1TEST",
        )
        self.mfi_1.auto_create_schema = False
        self.mfi_1.save()

        self.mfi_2 = MFI(
            name="MFI Two",
            registration_number="REG-2",
            email="m2@example.com",
            phone="000",
            address="addr",
            aom=self.aom_2,
            schema_name="mfi_two_test",
            code="MFI2TEST",
        )
        self.mfi_2.auto_create_schema = False
        self.mfi_2.save()

        self.super_admin = User.objects.create_user(
            username="super", password="pw", role=User.Role.SUPER_ADMIN
        )
        self.aom_1_staff = User.objects.create_user(
            username="aom1_staff",
            password="pw",
            role=User.Role.AOM_STAFF,
            aom=self.aom_1,
        )
        self.donor_1_staff = User.objects.create_user(
            username="donor1_staff",
            password="pw",
            role=User.Role.DONOR_STAFF,
            donor=self.donor_1,
        )
        self.mfi_1_officer = User.objects.create_user(
            username="mfi1_officer",
            password="pw",
            role=User.Role.LOAN_OFFICER,
            mfi=self.mfi_1,
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    # --- Donor: SUPER_ADMIN and the owning DONOR_STAFF only -------------

    def test_loan_officer_cannot_list_donors(self):
        response = self._client(self.mfi_1_officer).get("/api/donors/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_donor_staff_only_sees_their_own_donor(self):
        response = self._client(self.donor_1_staff).get("/api/donors/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in response.data["results"]]
        self.assertEqual(names, [self.donor_1.name])

    def test_donor_staff_cannot_edit_their_donor(self):
        response = self._client(self.donor_1_staff).patch(
            f"/api/donors/{self.donor_1.id}/", {"name": "Renamed"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_sees_all_donors(self):
        response = self._client(self.super_admin).get("/api/donors/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    # --- MFI registry: AoM staff scoped to their own AoM -----------------

    def test_aom_staff_only_sees_mfis_in_their_aom(self):
        response = self._client(self.aom_1_staff).get("/api/mfis/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in response.data["results"]]
        self.assertEqual(names, [self.mfi_1.name])

    def test_aom_staff_cannot_edit_mfi_in_another_aom(self):
        response = self._client(self.aom_1_staff).patch(
            f"/api/mfis/{self.mfi_2.id}/", {"is_active": False}
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_mfi_officer_only_sees_their_own_mfi_registry_row(self):
        response = self._client(self.mfi_1_officer).get("/api/mfis/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in response.data["results"]]
        self.assertEqual(names, [self.mfi_1.name])

    # --- MFIReport: separation of duty on approve ------------------------

    def test_mfi_staff_cannot_approve_their_own_report(self):
        report = MFIReport.objects.create(
            mfi=self.mfi_1,
            period="2026-08-01",
            status=MFIReport.ReportStatus.SUBMITTED,
        )
        response = self._client(self.mfi_1_officer).post(
            f"/api/mfi-reports/{report.id}/approve/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_aom_staff_can_approve_report_for_their_aoms_mfi(self):
        report = MFIReport.objects.create(
            mfi=self.mfi_1,
            period="2026-08-01",
            status=MFIReport.ReportStatus.SUBMITTED,
        )
        response = self._client(self.aom_1_staff).post(
            f"/api/mfi-reports/{report.id}/approve/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_aom_staff_cannot_see_other_aoms_reports(self):
        MFIReport.objects.create(
            mfi=self.mfi_2,
            period="2026-08-01",
            status=MFIReport.ReportStatus.SUBMITTED,
        )
        response = self._client(self.aom_1_staff).get("/api/mfi-reports/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


class FundFlowScopingTests(TestCase):
    """
    Donor -> AoM -> MFI wholesale fund flow: a donor funds an AoM
    (DonorContribution), the AoM re-lends to its MFIs (MFIDisbursement).
    Proves each tier only sees its own slice, and that MFI-role accounts
    get read-only visibility into their own disbursements only -- never
    another MFI's, and never edit rights over the AoM's ledger.
    """

    def setUp(self):
        public_tenant = MFI(
            schema_name="public",
            name="Public",
            code="PUBLIC",
            registration_number="PUBLIC-001",
            email="admin@localhost",
            phone="000",
            address="Public schema",
        )
        public_tenant.auto_create_schema = False
        public_tenant.save()
        Domain.objects.create(tenant=public_tenant, domain="testserver", is_primary=True)

        self.donor = Donor.objects.create(name="Donor A", contact_email="d@example.com")
        self.other_donor = Donor.objects.create(name="Donor B", contact_email="d2@example.com")

        self.aom_1 = AoM.objects.create(
            name="AoM One", code="AOM1", donor=self.donor, contact_email="a1@example.com"
        )
        self.aom_2 = AoM.objects.create(
            name="AoM Two", code="AOM2", donor=self.other_donor, contact_email="a2@example.com"
        )

        self.mfi_1 = MFI(
            name="MFI One", registration_number="REG-1", email="m1@example.com",
            phone="000", address="addr", aom=self.aom_1,
            schema_name="mfi_one_ff_test", code="MFI1FF",
        )
        self.mfi_1.auto_create_schema = False
        self.mfi_1.save()

        self.mfi_2 = MFI(
            name="MFI Two", registration_number="REG-2", email="m2@example.com",
            phone="000", address="addr", aom=self.aom_2,
            schema_name="mfi_two_ff_test", code="MFI2FF",
        )
        self.mfi_2.auto_create_schema = False
        self.mfi_2.save()

        self.super_admin = User.objects.create_user(
            username="ff_super", password="pw", role=User.Role.SUPER_ADMIN
        )
        self.aom_1_staff = User.objects.create_user(
            username="ff_aom1", password="pw", role=User.Role.AOM_STAFF, aom=self.aom_1
        )
        self.donor_staff = User.objects.create_user(
            username="ff_donor", password="pw", role=User.Role.DONOR_STAFF, donor=self.donor
        )
        self.mfi_1_admin = User.objects.create_user(
            username="ff_mfi1_admin", password="pw", role=User.Role.MFI_ADMIN, mfi=self.mfi_1
        )
        self.mfi_1_officer = User.objects.create_user(
            username="ff_mfi1_officer", password="pw", role=User.Role.LOAN_OFFICER, mfi=self.mfi_1
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    # --- DonorContribution ------------------------------------------------

    def test_donor_staff_can_record_contribution_to_own_aom(self):
        response = self._client(self.donor_staff).post(
            "/api/donor-contributions/",
            {
                "donor": self.donor.id,
                "aom": self.aom_1.id,
                "amount": "100000.00",
                "contribution_date": "2026-01-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_donor_staff_cannot_fund_an_aom_their_donor_does_not_sponsor(self):
        response = self._client(self.donor_staff).post(
            "/api/donor-contributions/",
            {
                "donor": self.donor.id,
                "aom": self.aom_2.id,  # sponsored by other_donor, not self.donor
                "amount": "100000.00",
                "contribution_date": "2026-01-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aom_staff_can_read_but_not_create_contributions(self):
        from .models import DonorContribution

        DonorContribution.objects.create(
            donor=self.donor, aom=self.aom_1, amount="50000.00",
            contribution_date="2026-01-01",
        )
        read_response = self._client(self.aom_1_staff).get("/api/donor-contributions/")
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data["count"], 1)

        write_response = self._client(self.aom_1_staff).post(
            "/api/donor-contributions/",
            {
                "donor": self.donor.id,
                "aom": self.aom_1.id,
                "amount": "1.00",
                "contribution_date": "2026-01-01",
            },
        )
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mfi_staff_cannot_see_donor_contributions_at_all(self):
        response = self._client(self.mfi_1_admin).get("/api/donor-contributions/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- MFIDisbursement ----------------------------------------------------

    def test_aom_staff_can_disburse_to_own_mfi(self):
        response = self._client(self.aom_1_staff).post(
            "/api/mfi-disbursements/",
            {
                "aom": self.aom_1.id,
                "mfi": self.mfi_1.id,
                "principal_amount": "50000.00",
                "interest_rate": "8.00",
                "term_months": 12,
                "disbursement_date": "2026-01-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_aom_staff_cannot_disburse_to_mfi_outside_their_aom(self):
        response = self._client(self.aom_1_staff).post(
            "/api/mfi-disbursements/",
            {
                "aom": self.aom_1.id,
                "mfi": self.mfi_2.id,  # belongs to aom_2, not aom_1
                "principal_amount": "50000.00",
                "interest_rate": "8.00",
                "term_months": 12,
                "disbursement_date": "2026-01-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mfi_admin_can_read_own_disbursement_but_not_edit(self):
        disbursement = MFIDisbursement.objects.create(
            aom=self.aom_1, mfi=self.mfi_1, principal_amount="50000.00",
            interest_rate="8.00", term_months=12, disbursement_date="2026-01-01",
        )
        read_response = self._client(self.mfi_1_admin).get(
            f"/api/mfi-disbursements/{disbursement.id}/"
        )
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)

        write_response = self._client(self.mfi_1_admin).patch(
            f"/api/mfi-disbursements/{disbursement.id}/",
            {"interest_rate": "1.00"},
        )
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mfi_officer_cannot_see_disbursements_at_all(self):
        MFIDisbursement.objects.create(
            aom=self.aom_1, mfi=self.mfi_1, principal_amount="50000.00",
            interest_rate="8.00", term_months=12, disbursement_date="2026-01-01",
        )
        response = self._client(self.mfi_1_officer).get("/api/mfi-disbursements/")
        # LOAN_OFFICER isn't in MFI_WRITE_ROLES, so MFIDisbursementPermission
        # denies at has_permission itself -- financial/strategic data, not
        # their level.
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mfi_1_cannot_see_mfi_2s_disbursements(self):
        MFIDisbursement.objects.create(
            aom=self.aom_2, mfi=self.mfi_2, principal_amount="20000.00",
            interest_rate="8.00", term_months=12, disbursement_date="2026-01-01",
        )
        response = self._client(self.mfi_1_admin).get("/api/mfi-disbursements/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_generate_schedule_produces_correct_totals(self):
        disbursement = MFIDisbursement.objects.create(
            aom=self.aom_1, mfi=self.mfi_1, principal_amount="50000.00",
            interest_rate="8.00", term_months=12, disbursement_date="2026-01-01",
        )
        response = self._client(self.aom_1_staff).post(
            f"/api/mfi-disbursements/{disbursement.id}/generate-schedule/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schedule = response.data["disbursement"]["schedule"]
        self.assertEqual(len(schedule), 12)

        principal_sum = sum(float(row["expected_principal"]) for row in schedule)
        self.assertAlmostEqual(principal_sum, 50000.00, places=2)

    def test_mfi_admin_cannot_trigger_schedule_generation(self):
        disbursement = MFIDisbursement.objects.create(
            aom=self.aom_1, mfi=self.mfi_1, principal_amount="50000.00",
            interest_rate="8.00", term_months=12, disbursement_date="2026-01-01",
        )
        response = self._client(self.mfi_1_admin).post(
            f"/api/mfi-disbursements/{disbursement.id}/generate-schedule/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
