"""
Authorization tests for the shared-schema endpoints in core/views.py.

Proves that GlobalUser.role actually restricts what a caller can see and
do on Donor / AoM / MFI / GlobalUser / report endpoints, instead of every
authenticated user seeing every organization's data.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
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


class UserPrivilegeEscalationTests(TestCase):
    """
    Regression tests for a real vulnerability found during review: the
    GlobalUserPermission object-level check allowed any user to PATCH
    their own account with no restriction on which fields changed
    (including role/is_staff/org assignment), and let AOM_STAFF write an
    arbitrary role onto any account within their AoM. Both are closed at
    the serializer level in GlobalUserSerializer.validate(), since
    permission classes only gate object-level access, not which fields
    are being changed.
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

        self.aom = AoM.objects.create(
            name="Esc AoM", code="ESCAOM", contact_email="a@example.com"
        )
        self.mfi = MFI(
            name="Esc MFI", registration_number="ESC-1", email="m@example.com",
            phone="0", address="a", aom=self.aom,
            schema_name="esc_mfi_test", code="ESCMFI",
        )
        self.mfi.auto_create_schema = False
        self.mfi.save()

        self.loan_officer = User.objects.create_user(
            username="esc_officer", password="pw", role=User.Role.LOAN_OFFICER, mfi=self.mfi
        )
        self.aom_staff = User.objects.create_user(
            username="esc_aom", password="pw", role=User.Role.AOM_STAFF, aom=self.aom
        )
        self.other_aom_staff = User.objects.create_user(
            username="esc_aom2", password="pw", role=User.Role.AOM_STAFF, aom=self.aom
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_user_cannot_self_promote_via_own_profile_edit(self):
        response = self._client(self.loan_officer).patch(
            f"/api/users/{self.loan_officer.id}/",
            {"role": "SUPER_ADMIN"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.loan_officer.refresh_from_db()
        self.assertEqual(self.loan_officer.role, "LOAN_OFFICER")

    def test_user_cannot_reassign_own_mfi_via_profile_edit(self):
        other_mfi = MFI(
            name="Other Esc MFI", registration_number="ESC-2", email="m2@example.com",
            phone="0", address="a", aom=self.aom,
            schema_name="esc_mfi2_test", code="ESCMFI2",
        )
        other_mfi.auto_create_schema = False
        other_mfi.save()

        response = self._client(self.loan_officer).patch(
            f"/api/users/{self.loan_officer.id}/",
            {"mfi": other_mfi.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_can_still_self_edit_ordinary_profile_fields(self):
        response = self._client(self.loan_officer).patch(
            f"/api/users/{self.loan_officer.id}/",
            {"first_name": "New", "email": "new@example.com"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_aom_staff_cannot_grant_super_admin_to_a_peer(self):
        response = self._client(self.aom_staff).patch(
            f"/api/users/{self.other_aom_staff.id}/",
            {"role": "SUPER_ADMIN"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.other_aom_staff.refresh_from_db()
        self.assertEqual(self.other_aom_staff.role, "AOM_STAFF")

    def test_aom_staff_cannot_grant_aom_staff_role_to_new_user(self):
        # AOM_STAFF's assignable set is MFI_ADMIN/MFI_MANAGER/LOAN_OFFICER
        # only -- they can't create peers or escalate anyone to their own
        # level or above.
        response = self._client(self.aom_staff).post(
            "/api/users/",
            {
                "username": "escalated",
                "password": "pw12345",
                "role": "AOM_STAFF",
                "aom": self.aom.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aom_staff_can_create_mfi_admin_within_their_own_aom(self):
        response = self._client(self.aom_staff).post(
            "/api/users/",
            {
                "username": "legit_mfi_admin",
                "password": "pw12345",
                "role": "MFI_ADMIN",
                "mfi": self.mfi.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_aom_staff_cannot_assign_user_to_mfi_outside_their_aom(self):
        other_aom = AoM.objects.create(
            name="Other Esc AoM", code="ESCAOM2", contact_email="a2@example.com"
        )
        other_mfi = MFI(
            name="Outside MFI", registration_number="ESC-3", email="m3@example.com",
            phone="0", address="a", aom=other_aom,
            schema_name="esc_mfi3_test", code="ESCMFI3",
        )
        other_mfi.auto_create_schema = False
        other_mfi.save()

        response = self._client(self.aom_staff).post(
            "/api/users/",
            {
                "username": "cross_org_user",
                "password": "pw12345",
                "role": "MFI_ADMIN",
                "mfi": other_mfi.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationsTests(TestCase):
    """
    Proves /api/notifications/summary/ returns real counts scoped to the
    caller's own organization -- not a static/fake value, and never
    counting items outside what the caller could actually act on.
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

        self.aom_1 = AoM.objects.create(
            name="Notif AoM One", code="NOTAOM1", contact_email="a1@example.com"
        )
        self.aom_2 = AoM.objects.create(
            name="Notif AoM Two", code="NOTAOM2", contact_email="a2@example.com"
        )

        self.mfi_1 = MFI(
            name="Notif MFI One", registration_number="NOTREG-1", email="m1@example.com",
            phone="0", address="a", aom=self.aom_1,
            schema_name="notif_mfi1_test", code="NOTMFI1",
        )
        self.mfi_1.auto_create_schema = False
        self.mfi_1.save()

        self.mfi_2 = MFI(
            name="Notif MFI Two", registration_number="NOTREG-2", email="m2@example.com",
            phone="0", address="a", aom=self.aom_2,
            schema_name="notif_mfi2_test", code="NOTMFI2",
        )
        self.mfi_2.auto_create_schema = False
        self.mfi_2.save()

        self.aom_1_staff = User.objects.create_user(
            username="notif_aom1", password="pw", role=User.Role.AOM_STAFF, aom=self.aom_1
        )
        self.aom_2_staff = User.objects.create_user(
            username="notif_aom2", password="pw", role=User.Role.AOM_STAFF, aom=self.aom_2
        )

        MFIReport.objects.create(
            mfi=self.mfi_1, period="2026-08-01", status=MFIReport.ReportStatus.SUBMITTED
        )
        MFIReport.objects.create(
            mfi=self.mfi_2, period="2026-08-01", status=MFIReport.ReportStatus.SUBMITTED
        )
        # A draft report should never count -- only SUBMITTED needs action.
        MFIReport.objects.create(
            mfi=self.mfi_1, period="2026-07-01", status=MFIReport.ReportStatus.DRAFT
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_aom_staff_only_sees_their_own_pending_mfi_reports(self):
        response = self._client(self.aom_1_staff).get("/api/notifications/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        mfi_report_items = [
            i for i in response.data["items"] if i["type"] == "mfi_report_pending"
        ]
        self.assertEqual(len(mfi_report_items), 1)
        self.assertEqual(mfi_report_items[0]["count"], 1)  # only mfi_1's, not mfi_2's

    def test_aom_2_staff_sees_their_own_count_not_aom_1s(self):
        response = self._client(self.aom_2_staff).get("/api/notifications/summary/")
        mfi_report_items = [
            i for i in response.data["items"] if i["type"] == "mfi_report_pending"
        ]
        self.assertEqual(mfi_report_items[0]["count"], 1)

    def test_draft_reports_never_count_as_pending(self):
        # mfi_1 has 1 SUBMITTED + 1 DRAFT report -- only the submitted one
        # should ever surface as something needing action.
        response = self._client(self.aom_1_staff).get("/api/notifications/summary/")
        mfi_report_items = [
            i for i in response.data["items"] if i["type"] == "mfi_report_pending"
        ]
        self.assertEqual(mfi_report_items[0]["count"], 1)


class PasswordResetTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()

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

        self.user = User.objects.create_user(
            username="pwreset_user",
            password="OldPassword123",
            email="pwreset@example.com",
            role=User.Role.LOAN_OFFICER,
        )

    def test_request_returns_generic_message_for_unknown_email(self):
        # Must not leak whether an email is registered -- same response
        # either way.
        response = self.client.post(
            "/api/password-reset/", {"email": "nobody@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account exists", response.data["detail"])

    def test_request_returns_same_generic_message_for_known_email(self):
        response = self.client.post(
            "/api/password-reset/", {"email": self.user.email}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account exists", response.data["detail"])

    def test_full_reset_flow_actually_changes_the_password(self):
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = PasswordResetTokenGenerator().make_token(self.user)

        response = self.client.post(
            "/api/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "BrandNewPassword456"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPassword456"))
        self.assertFalse(self.user.check_password("OldPassword123"))

    def test_reset_confirm_rejects_invalid_token(self):
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        response = self.client.post(
            "/api/password-reset-confirm/",
            {"uid": uid, "token": "not-a-real-token", "new_password": "Whatever12345"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123"))

    def test_reset_confirm_rejects_token_after_password_already_changed(self):
        # Django's PasswordResetTokenGenerator invalidates a token once
        # the password it was issued for has changed -- proves a used
        # link can't be replayed.
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = PasswordResetTokenGenerator().make_token(self.user)

        first = self.client.post(
            "/api/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "FirstNewPassword1"},
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        replay = self.client.post(
            "/api/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "SecondNewPassword2"},
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_confirm_rejects_short_password(self):
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = PasswordResetTokenGenerator().make_token(self.user)

        response = self.client.post(
            "/api/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "short"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_request_actually_sends_an_email(self):
        from django.core import mail

        self.client.post("/api/password-reset/", {"email": self.user.email})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.user.username, mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [self.user.email])


class CrossOrgDataLeakageTests(TestCase):
    """
    Directly proves (or disproves) the report: "MFI users can see other
    MFI's data, including SUPER_ADMIN, AOM staff, donor staff, and other
    MFI admins." Covers every list endpoint an MFI-role account can
    reach -- not just Users -- since the report says this isn't scoped
    to user data alone.
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

        self.donor = Donor.objects.create(name="Leak Donor", contact_email="d@example.com")
        self.aom = AoM.objects.create(
            name="Leak AoM", code="LEAKAOM", donor=self.donor, contact_email="a@example.com"
        )
        self.other_aom = AoM.objects.create(
            name="Other Leak AoM", code="LEAKAOM2", donor=self.donor, contact_email="a2@example.com"
        )

        self.mfi_a = MFI(
            name="Leak MFI A", registration_number="LEAK-A", email="ma@example.com",
            phone="0", address="a", aom=self.aom,
            schema_name="leak_mfi_a_test", code="LEAKMFIA",
        )
        self.mfi_a.auto_create_schema = False
        self.mfi_a.save()

        self.mfi_b = MFI(
            name="Leak MFI B", registration_number="LEAK-B", email="mb@example.com",
            phone="0", address="a", aom=self.other_aom,
            schema_name="leak_mfi_b_test", code="LEAKMFIB",
        )
        self.mfi_b.auto_create_schema = False
        self.mfi_b.save()

        self.super_admin = User.objects.create_user(
            username="leak_super", password="pw", role=User.Role.SUPER_ADMIN
        )
        self.aom_staff = User.objects.create_user(
            username="leak_aom_staff", password="pw", role=User.Role.AOM_STAFF, aom=self.aom
        )
        self.donor_staff = User.objects.create_user(
            username="leak_donor_staff", password="pw", role=User.Role.DONOR_STAFF, donor=self.donor
        )
        self.mfi_a_admin = User.objects.create_user(
            username="leak_mfi_a_admin", password="pw", role=User.Role.MFI_ADMIN, mfi=self.mfi_a
        )
        self.mfi_a_officer = User.objects.create_user(
            username="leak_mfi_a_officer", password="pw", role=User.Role.LOAN_OFFICER, mfi=self.mfi_a
        )
        self.mfi_b_admin = User.objects.create_user(
            username="leak_mfi_b_admin", password="pw", role=User.Role.MFI_ADMIN, mfi=self.mfi_b
        )

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_mfi_admin_user_list_excludes_everyone_outside_their_own_mfi(self):
        response = self._client(self.mfi_a_admin).get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {row["username"] for row in response.data["results"]}

        # Should see only themselves and their MFI's own loan officer.
        self.assertEqual(usernames, {"leak_mfi_a_admin", "leak_mfi_a_officer"})

        # Explicitly must NOT see any of these.
        self.assertNotIn("leak_super", usernames)
        self.assertNotIn("leak_aom_staff", usernames)
        self.assertNotIn("leak_donor_staff", usernames)
        self.assertNotIn("leak_mfi_b_admin", usernames)

    def test_mfi_officer_user_list_excludes_everyone_outside_their_own_mfi(self):
        response = self._client(self.mfi_a_officer).get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {row["username"] for row in response.data["results"]}
        self.assertEqual(usernames, {"leak_mfi_a_admin", "leak_mfi_a_officer"})
        self.assertNotIn("leak_super", usernames)
        self.assertNotIn("leak_mfi_b_admin", usernames)

    def test_mfi_admin_cannot_fetch_another_mfis_admin_by_id(self):
        response = self._client(self.mfi_a_admin).get(
            f"/api/users/{self.mfi_b_admin.id}/"
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_mfi_admin_cannot_fetch_super_admin_by_id(self):
        response = self._client(self.mfi_a_admin).get(
            f"/api/users/{self.super_admin.id}/"
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_mfi_admin_cannot_see_other_mfis_registry_entry(self):
        response = self._client(self.mfi_a_admin).get("/api/mfis/")
        names = {row["name"] for row in response.data["results"]}
        self.assertEqual(names, {"Leak MFI A"})
        self.assertNotIn("Leak MFI B", names)

    def test_mfi_admin_cannot_see_any_donor(self):
        response = self._client(self.mfi_a_admin).get("/api/donors/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mfi_admin_cannot_see_any_aom(self):
        response = self._client(self.mfi_a_admin).get("/api/aoms/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MFIOnboardingTests(TransactionTestCase):
    """
    Regression tests for two real bugs found during review:
    1. MFIListSerializer required `code`, which the onboarding form never
       collects (it's meant to be auto-generated, same as schema_name).
    2. Nothing ever created a Domain record for a newly onboarded MFI,
       which meant the MFI was completely unreachable via
       X-Tenant-Subdomain forever -- every tenant-scoped write (Region,
       Branch, Member, Loan, all of it) would fail for that MFI. Root
       cause: core/signals.py's post_save handler ran before
       MFI.save()'s own create_schema() call, so any tenant-schema work
       attempted there always failed.
    """

    def setUp(self):
        public_tenant = MFI.objects.filter(schema_name="public").first()
        if public_tenant is None:
            public_tenant = MFI(
                schema_name="public",
                name="Public",
                code="PUBLICROOT",
                registration_number="PUBLIC-ROOT-001",
                email="admin@localhost",
                phone="000",
                address="Public schema",
            )
            public_tenant.auto_create_schema = False
            public_tenant.save()
        Domain.objects.get_or_create(
            tenant=public_tenant,
            domain="testserver",
            defaults={"is_primary": True},
        )

        suffix = self._testMethodName[-20:]

        self.donor = Donor.objects.create(
            name=f"Onboard Donor {suffix}", contact_email="d@example.com"
        )
        self.aom = AoM.objects.create(
            name=f"Onboard AoM {suffix}",
            code=f"ONBAOM{suffix}"[:20],
            donor=self.donor,
            contact_email="a@example.com",
        )
        self.super_admin = User.objects.create_user(
            username=f"onboard_super_{suffix}", password="pw", role=User.Role.SUPER_ADMIN
        )

    def _client(self):
        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        return client

    def test_onboarding_an_mfi_does_not_require_a_client_supplied_code(self):
        response = self._client().post(
            "/api/mfis/",
            {
                "name": "Onboard Test MFI",
                "registration_number": "ONB-REG-1",
                "email": "m@example.com",
                "phone": "000",
                "address": "addr",
                "aom": self.aom.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["code"])

        mfi = MFI.objects.get(id=response.data["id"])
        self.addCleanup(lambda: mfi.delete(force_drop=True))

    def test_onboarding_an_mfi_creates_a_resolvable_domain(self):
        response = self._client().post(
            "/api/mfis/",
            {
                "name": "Domain Test MFI",
                "registration_number": "ONB-REG-2",
                "email": "m2@example.com",
                "phone": "000",
                "address": "addr",
                "aom": self.aom.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mfi = MFI.objects.get(id=response.data["id"])
        self.addCleanup(lambda: mfi.delete(force_drop=True))

        self.assertTrue(Domain.objects.filter(tenant=mfi).exists())

    def test_a_freshly_onboarded_mfi_can_immediately_accept_tenant_writes(self):
        # This is the real end-to-end proof: an MFI onboarded through the
        # normal API flow must be able to save a Region right away --
        # this is the exact bug reported ("Region fail to save").
        response = self._client().post(
            "/api/mfis/",
            {
                "name": "Region Test MFI",
                "registration_number": "ONB-REG-3",
                "email": "m3@example.com",
                "phone": "000",
                "address": "addr",
                "aom": self.aom.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mfi = MFI.objects.get(id=response.data["id"])
        self.addCleanup(lambda: mfi.delete(force_drop=True))

        mfi_admin = User.objects.create_user(
            username="region_test_mfi_admin",
            password="pw",
            role=User.Role.MFI_ADMIN,
            mfi=mfi,
        )
        client = APIClient()
        client.force_authenticate(user=mfi_admin)
        client.credentials(HTTP_X_TENANT_SUBDOMAIN=mfi.schema_name)

        region_response = client.post(
            "/api/tenant/regions/", {"name": "Kilimanjaro"}
        )
        self.assertEqual(region_response.status_code, status.HTTP_201_CREATED)

    def test_onboarded_mfi_gets_default_tenant_data_seeded(self):
        response = self._client().post(
            "/api/mfis/",
            {
                "name": "Defaults Test MFI",
                "registration_number": "ONB-REG-4",
                "email": "m4@example.com",
                "phone": "000",
                "address": "addr",
                "aom": self.aom.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mfi = MFI.objects.get(id=response.data["id"])
        self.addCleanup(lambda: mfi.delete(force_drop=True))

        from django_tenants.utils import schema_context
        from tenants.models import Branch, Region

        with schema_context(mfi.schema_name):
            self.assertTrue(Region.objects.filter(name="Default Region").exists())
            self.assertTrue(Branch.objects.filter(name="Main Branch").exists())


class RepairMFITenantsTests(TransactionTestCase):
    """
    Proves the retroactive repair path for MFIs that were created before
    the Domain/onboarding fix existed -- both the repair_mfi_tenants
    management command and the fixed create_schema action (which
    previously called mfi.save(), a no-op for an existing row since
    TenantMixin only creates a schema when is_new=True).
    """

    def setUp(self):
        public_tenant = MFI.objects.filter(schema_name="public").first()
        if public_tenant is None:
            public_tenant = MFI(
                schema_name="public",
                name="Public",
                code="REPAIRPUBLIC",
                registration_number="REPAIR-PUBLIC-001",
                email="admin@localhost",
                phone="000",
                address="Public schema",
            )
            public_tenant.auto_create_schema = False
            public_tenant.save()
        Domain.objects.get_or_create(
            tenant=public_tenant,
            domain="testserver",
            defaults={"is_primary": True},
        )

        self.donor = Donor.objects.create(
            name="Repair Donor", contact_email="d@example.com"
        )
        self.aom = AoM.objects.create(
            name="Repair AoM", code="REPAOM", donor=self.donor, contact_email="a@example.com"
        )
        self.super_admin = User.objects.create_user(
            username="repair_super", password="pw", role=User.Role.SUPER_ADMIN
        )

        # Simulate an MFI created the "broken" way: auto_create_schema
        # disabled, so no schema, no Domain, no defaults -- exactly the
        # state a pre-fix onboarded MFI could be left in.
        self.broken_mfi = MFI(
            name="Broken MFI",
            registration_number="REPAIR-REG-1",
            email="broken@example.com",
            phone="000",
            address="addr",
            aom=self.aom,
        )
        self.broken_mfi.auto_create_schema = False
        self.broken_mfi.save()

    def tearDown(self):
        from django.db import connection

        connection.set_schema_to_public()
        self.broken_mfi.delete(force_drop=True)

    def test_repair_command_creates_missing_schema_domain_and_defaults(self):
        from django.core.management import call_command
        from django_tenants.utils import schema_context, schema_exists
        from tenants.models import Branch, Region

        self.assertFalse(schema_exists(self.broken_mfi.schema_name))
        self.assertFalse(Domain.objects.filter(tenant=self.broken_mfi).exists())

        call_command("repair_mfi_tenants", mfi_id=self.broken_mfi.id)

        self.assertTrue(schema_exists(self.broken_mfi.schema_name))
        self.assertTrue(Domain.objects.filter(tenant=self.broken_mfi).exists())

        with schema_context(self.broken_mfi.schema_name):
            self.assertTrue(Region.objects.filter(name="Default Region").exists())
            self.assertTrue(Branch.objects.filter(name="Main Branch").exists())

    def test_repair_command_dry_run_makes_no_changes(self):
        from django.core.management import call_command
        from django_tenants.utils import schema_exists

        call_command("repair_mfi_tenants", mfi_id=self.broken_mfi.id, dry_run=True)

        self.assertFalse(schema_exists(self.broken_mfi.schema_name))
        self.assertFalse(Domain.objects.filter(tenant=self.broken_mfi).exists())

    def test_repaired_mfi_accepts_region_and_member_writes_afterward(self):
        from django.core.management import call_command

        call_command("repair_mfi_tenants", mfi_id=self.broken_mfi.id)

        mfi_admin = User.objects.create_user(
            username="repair_mfi_admin",
            password="pw",
            role=User.Role.MFI_ADMIN,
            mfi=self.broken_mfi,
        )
        client = APIClient()
        client.force_authenticate(user=mfi_admin)
        client.credentials(HTTP_X_TENANT_SUBDOMAIN=self.broken_mfi.schema_name)

        region_response = client.post("/api/tenant/regions/", {"name": "Post-Repair Region"})
        self.assertEqual(region_response.status_code, status.HTTP_201_CREATED)

        member_response = client.post(
            "/api/tenant/members/",
            {
                "member_id": "POSTREPAIR01",
                "name": "Post Repair Member",
                "gender": "F",
                "borrower_type": "IND",
                "is_active": True,
            },
        )
        self.assertEqual(member_response.status_code, status.HTTP_201_CREATED)

    def test_create_schema_action_repairs_an_existing_broken_mfi(self):
        # Regression test: the old implementation called mfi.save(),
        # which is a no-op for schema creation on an existing row
        # (TenantMixin only creates a schema when is_new=True) -- this
        # action silently did nothing for exactly the case it claimed to
        # fix.
        from django_tenants.utils import schema_exists

        self.assertFalse(schema_exists(self.broken_mfi.schema_name))

        client = APIClient()
        client.force_authenticate(user=self.super_admin)
        response = client.post(f"/api/mfis/{self.broken_mfi.id}/create_schema/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(schema_exists(self.broken_mfi.schema_name))
        self.assertTrue(Domain.objects.filter(tenant=self.broken_mfi).exists())
