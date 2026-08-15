"""
Role-based authorization for LoanTrack's public/shared-schema endpoints.

GlobalUser.role (see core.models.GlobalUser.Role) is the source of truth:

    SUPER_ADMIN   full access to every Donor / AoM / MFI / report.
    AOM_STAFF     scoped to their own AoM: that AoM's MFIs, MFI reports and
                  AoM report. Can read the parent Donor but not edit it.
    DONOR_STAFF   scoped to their own Donor: oversight/read access to the
                  AoMs and MFIs funded by that donor, and the reports chain.
                  Read-mostly by design -- donors oversee, they don't
                  operate MFIs.
    MFI_ADMIN     scoped to their own MFI record and its reports.
    MFI_MANAGER   same scope as MFI_ADMIN, no user-management rights.
    LOAN_OFFICER  same scope, read-only on the MFI/report records.

Each permission class below is used two ways:
    1. As a DRF `permission_classes` entry -- coarse allow/deny plus
       per-object checks for retrieve/update/delete.
    2. Its `scope_queryset()` classmethod is called from the view's
       `get_queryset()` so list results are filtered up front rather than
       relying on object-level checks to reject requests one at a time.

These are deliberately conservative defaults built from the roles already
modeled on GlobalUser. Adjust the exact business rules (e.g. whether
AOM_STAFF can edit MFI records, or only view them) to match how you
actually want the org hierarchy to operate -- the scoping mechanism itself
is what matters, and it's centralized here so it's easy to change in one
place.
"""

from rest_framework import permissions

SUPER_ADMIN = "SUPER_ADMIN"
AOM_STAFF = "AOM_STAFF"
DONOR_STAFF = "DONOR_STAFF"
MFI_ADMIN = "MFI_ADMIN"
MFI_MANAGER = "MFI_MANAGER"
LOAN_OFFICER = "LOAN_OFFICER"

MFI_STAFF_ROLES = {MFI_ADMIN, MFI_MANAGER, LOAN_OFFICER}
MFI_WRITE_ROLES = {MFI_ADMIN, MFI_MANAGER}

SAFE_METHODS = permissions.SAFE_METHODS


def get_role(request):
    user = request.user
    if not user or not user.is_authenticated:
        return None
    return getattr(user, "role", None)


def is_super_admin(request):
    return get_role(request) == SUPER_ADMIN


class DonorPermission(permissions.BasePermission):
    """
    Donor rows. SUPER_ADMIN: full CRUD. DONOR_STAFF: read their own donor
    only. Everyone else: no access -- donor identity/contact info is not
    something an MFI-level or AoM-level user needs.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == DONOR_STAFF:
            return (
                request.method in SAFE_METHODS
                and obj.id == request.user.donor_id
            )
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return queryset
        if role == DONOR_STAFF:
            return queryset.filter(id=request.user.donor_id)
        return queryset.none()


class AoMPermission(permissions.BasePermission):
    """
    AoM rows. SUPER_ADMIN: full CRUD. AOM_STAFF: read/write their own AoM.
    DONOR_STAFF: read the AoMs their donor funds. MFI-level roles: no
    access -- they don't need the AoM's own contact/admin record.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == AOM_STAFF:
            return True
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == AOM_STAFF:
            return obj.id == request.user.aom_id
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and obj.donor_id == request.user.donor_id
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return queryset
        if role == AOM_STAFF:
            return queryset.filter(id=request.user.aom_id)
        if role == DONOR_STAFF:
            return queryset.filter(donor_id=request.user.donor_id)
        return queryset.none()


class MFIPermission(permissions.BasePermission):
    """
    MFI registry rows (public schema -- name, code, schema_name, contact
    info, not the tenant's operational data). SUPER_ADMIN: full CRUD.
    AOM_STAFF: read/write MFIs under their own AoM. DONOR_STAFF: read MFIs
    they fund (directly or via the AoM). MFI-level roles: read their own
    MFI record only.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        if role in (SUPER_ADMIN, AOM_STAFF):
            return True
        if role == DONOR_STAFF or role in MFI_STAFF_ROLES:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == AOM_STAFF:
            return obj.aom_id == request.user.aom_id
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and (
                obj.donor_id == request.user.donor_id
                or (obj.aom_id and obj.aom.donor_id == request.user.donor_id)
            )
        if role in MFI_STAFF_ROLES:
            return request.method in SAFE_METHODS and obj.id == request.user.mfi_id
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return queryset
        if role == AOM_STAFF:
            return queryset.filter(aom_id=request.user.aom_id)
        if role == DONOR_STAFF:
            from django.db.models import Q

            return queryset.filter(
                Q(donor_id=request.user.donor_id)
                | Q(aom__donor_id=request.user.donor_id)
            )
        if role in MFI_STAFF_ROLES:
            return queryset.filter(id=request.user.mfi_id)
        return queryset.none()


class GlobalUserPermission(permissions.BasePermission):
    """
    Other GlobalUser accounts. SUPER_ADMIN: full CRUD. AOM_STAFF: read/write
    accounts belonging to their own AoM or to MFIs under it (managing their
    org's staff). DONOR_STAFF: read accounts under their donor. MFI_ADMIN:
    read/write LOAN_OFFICER/MFI_MANAGER accounts at their own MFI (can't
    create or edit another MFI_ADMIN). MFI_MANAGER/LOAN_OFFICER: read
    accounts at their own MFI only.

    Note: the separate `/me/` action bypasses this entirely and always
    returns the caller's own record -- that's intentional and unrelated to
    directory access.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        return role is not None

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        user = request.user

        if role == SUPER_ADMIN:
            return True
        if obj.id == user.id:
            return True  # always allowed to see/edit your own account here
        if role == AOM_STAFF:
            return obj.aom_id == user.aom_id or (
                obj.mfi_id and obj.mfi.aom_id == user.aom_id
            )
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and (
                obj.donor_id == user.donor_id
                or (obj.aom_id and obj.aom.donor_id == user.donor_id)
                or (obj.mfi_id and obj.mfi.donor_id == user.donor_id)
            )
        if role == MFI_ADMIN:
            return obj.mfi_id == user.mfi_id and obj.role in {
                MFI_MANAGER,
                LOAN_OFFICER,
            }
        if role in (MFI_MANAGER, LOAN_OFFICER):
            return request.method in SAFE_METHODS and obj.mfi_id == user.mfi_id
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return queryset
        if role == AOM_STAFF:
            from django.db.models import Q

            return queryset.filter(
                Q(aom_id=user.aom_id) | Q(mfi__aom_id=user.aom_id)
            )
        if role == DONOR_STAFF:
            from django.db.models import Q

            return queryset.filter(
                Q(donor_id=user.donor_id)
                | Q(aom__donor_id=user.donor_id)
                | Q(mfi__donor_id=user.donor_id)
            )
        if role in MFI_STAFF_ROLES:
            return queryset.filter(mfi_id=user.mfi_id)
        return queryset.none()


class DomainPermission(permissions.BasePermission):
    """
    Tenant domain routing rows. This is infrastructure config (which
    hostname resolves to which tenant schema), not operational data --
    keep it SUPER_ADMIN only.
    """

    def has_permission(self, request, view):
        return is_super_admin(request)

    def has_object_permission(self, request, view, obj):
        return is_super_admin(request)

    @classmethod
    def scope_queryset(cls, request, queryset):
        if is_super_admin(request):
            return queryset
        return queryset.none()


class ExchangeRatePermission(permissions.BasePermission):
    """
    Exchange rates feed every report's currency conversion. Any
    authenticated user may read them; only SUPER_ADMIN may write, since a
    bad rate silently corrupts every downstream MFI/AoM/Donor report.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return get_role(request) is not None
        return is_super_admin(request)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return get_role(request) is not None
        return is_super_admin(request)


class ReportPermission(permissions.BasePermission):
    """
    Shared base for MFIReport / AoMReport / DonorReport. Subclasses supply
    the field-name lookups needed to trace a report back to its
    MFI/AoM/Donor owner from both a queryset (`scope_queryset`) and a
    resolved object (`has_object_permission`).
    """

    # Overridden per subclass: kwargs for queryset.filter() keyed by role.
    def owner_filter_kwargs(self, request):
        raise NotImplementedError

    def owns_object(self, request, obj):
        raise NotImplementedError

    def has_permission(self, request, view):
        return get_role(request) is not None

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        return self.owns_object(request, obj)

    def scope_queryset(self, request, queryset):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return queryset
        kwargs = self.owner_filter_kwargs(request)
        if kwargs is None:
            return queryset.none()
        from django.db.models import Q

        query = Q()
        for kw in kwargs:
            query |= Q(**kw)
        return queryset.filter(query)


class MFIReportPermission(ReportPermission):
    def owner_filter_kwargs(self, request):
        role = get_role(request)
        user = request.user
        if role == AOM_STAFF:
            return [{"mfi__aom_id": user.aom_id}]
        if role == DONOR_STAFF:
            return [{"mfi__donor_id": user.donor_id}, {"mfi__aom__donor_id": user.donor_id}]
        if role in MFI_STAFF_ROLES:
            return [{"mfi_id": user.mfi_id}]
        return None

    def owns_object(self, request, obj):
        role = get_role(request)
        user = request.user
        if role == AOM_STAFF:
            return obj.mfi.aom_id == user.aom_id
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and (
                obj.mfi.donor_id == user.donor_id
                or (obj.mfi.aom_id and obj.mfi.aom.donor_id == user.donor_id)
            )
        if role in MFI_STAFF_ROLES:
            return obj.mfi_id == user.mfi_id
        return False


class AoMReportPermission(ReportPermission):
    def owner_filter_kwargs(self, request):
        role = get_role(request)
        user = request.user
        if role == AOM_STAFF:
            return [{"aom_id": user.aom_id}]
        if role == DONOR_STAFF:
            return [{"aom__donor_id": user.donor_id}]
        return None

    def owns_object(self, request, obj):
        role = get_role(request)
        user = request.user
        if role == AOM_STAFF:
            return obj.aom_id == user.aom_id
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and obj.aom.donor_id == user.donor_id
        return False


class DonorReportPermission(ReportPermission):
    def owner_filter_kwargs(self, request):
        role = get_role(request)
        user = request.user
        if role == DONOR_STAFF:
            return [{"donor_id": user.donor_id}]
        return None

    def owns_object(self, request, obj):
        role = get_role(request)
        user = request.user
        if role == DONOR_STAFF:
            return obj.donor_id == user.donor_id
        return False


# =============================================================================
# Fund flow: Donor -> AoM -> MFI
# =============================================================================
# These describe the wholesale layer above individual lending: a donor
# funding an AoM, and an AoM re-lending that capital to its MFIs.
# MFI-role accounts get READ-ONLY visibility into their own MFI's
# disbursements (they need to know what they owe upward) but never edit
# the AoM's ledger -- setting wholesale terms is the AoM's decision, not
# the MFI's.


class DonorContributionPermission(permissions.BasePermission):
    """
    SUPER_ADMIN: full CRUD. DONOR_STAFF: read/write contributions from
    their own donor. AOM_STAFF: read contributions made to their own AoM
    (so they can see what capital they actually have to disburse) but
    never edit -- that's the donor's record of what they gave. MFI roles:
    no access; this is above their level entirely.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        if role == SUPER_ADMIN:
            return True
        if role == DONOR_STAFF:
            return True
        if role == AOM_STAFF:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return True
        if role == DONOR_STAFF:
            return obj.donor_id == user.donor_id
        if role == AOM_STAFF:
            return request.method in SAFE_METHODS and obj.aom_id == user.aom_id
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return queryset
        if role == DONOR_STAFF:
            return queryset.filter(donor_id=user.donor_id)
        if role == AOM_STAFF:
            return queryset.filter(aom_id=user.aom_id)
        return queryset.none()


class MFIDisbursementPermission(permissions.BasePermission):
    """
    SUPER_ADMIN: full CRUD. AOM_STAFF: read/write disbursements from
    their own AoM to its MFIs -- this is how the AoM actually re-lends
    donor capital onward. DONOR_STAFF: read disbursements funded by
    AoMs their donor sponsors (oversight of where their money ended up).
    MFI_ADMIN / MFI_MANAGER: read-only on disbursements to their own MFI
    (they need to know what's outstanding and due, not edit the terms).
    LOAN_OFFICER: no access -- this is financial/strategic, not the
    operational individual-lending work loan officers do.
    """

    def has_permission(self, request, view):
        role = get_role(request)
        if role in (SUPER_ADMIN, AOM_STAFF):
            return True
        if role == DONOR_STAFF or role in MFI_WRITE_ROLES:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return True
        if role == AOM_STAFF:
            return obj.aom_id == user.aom_id
        if role == DONOR_STAFF:
            return request.method in SAFE_METHODS and (
                obj.aom.donor_id == user.donor_id
            )
        if role in MFI_WRITE_ROLES:
            return request.method in SAFE_METHODS and obj.mfi_id == user.mfi_id
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return queryset
        if role == AOM_STAFF:
            return queryset.filter(aom_id=user.aom_id)
        if role == DONOR_STAFF:
            return queryset.filter(aom__donor_id=user.donor_id)
        if role in MFI_WRITE_ROLES:
            return queryset.filter(mfi_id=user.mfi_id)
        return queryset.none()


class MFIDisbursementRepaymentPermission(permissions.BasePermission):
    """Same scoping as MFIDisbursementPermission, traced through the parent disbursement."""

    def has_permission(self, request, view):
        role = get_role(request)
        if role in (SUPER_ADMIN, AOM_STAFF):
            return True
        if role == DONOR_STAFF or role in MFI_WRITE_ROLES:
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return True
        if role == AOM_STAFF:
            return obj.disbursement.aom_id == user.aom_id
        if role == DONOR_STAFF:
            return (
                request.method in SAFE_METHODS
                and obj.disbursement.aom.donor_id == user.donor_id
            )
        if role in MFI_WRITE_ROLES:
            return (
                request.method in SAFE_METHODS
                and obj.disbursement.mfi_id == user.mfi_id
            )
        return False

    @classmethod
    def scope_queryset(cls, request, queryset):
        role = get_role(request)
        user = request.user
        if role == SUPER_ADMIN:
            return queryset
        if role == AOM_STAFF:
            return queryset.filter(disbursement__aom_id=user.aom_id)
        if role == DONOR_STAFF:
            return queryset.filter(disbursement__aom__donor_id=user.donor_id)
        if role in MFI_WRITE_ROLES:
            return queryset.filter(disbursement__mfi_id=user.mfi_id)
        return queryset.none()
