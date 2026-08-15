from django.db import connection
from django.http import Http404
from django_tenants.middleware import TenantMainMiddleware
from django_tenants.utils import (
    get_public_schema_name,
    get_tenant_domain_model,
    get_tenant_model,
)


class TenantHeaderMiddleware(TenantMainMiddleware):
    """
    Routes requests to the correct MFI tenant schema based on the
    'X-Tenant-Subdomain' header.

    If no header is present, it falls back to standard django-tenants behavior.
    """

    def process_request(self, request):
        tenant_subdomain = request.headers.get("X-Tenant-Subdomain")

        if tenant_subdomain:
            DomainModel = get_tenant_domain_model()

            candidates = [tenant_subdomain]

            # Allow frontend to send only subdomain, e.g. "mfi1"
            # while Domain.domain stores "mfi1.localhost"
            if "." not in tenant_subdomain:
                host = request.get_host().split(":")[0]

                if "." in host:
                    base_domain = ".".join(host.split(".")[1:])
                    candidates.append(f"{tenant_subdomain}.{base_domain}")
                else:
                    candidates.append(f"{tenant_subdomain}.{host}")

            domain = None

            for candidate in candidates:
                domain = (
                    DomainModel.objects.select_related("tenant")
                    .filter(domain=candidate)
                    .first()
                )
                if domain:
                    break

            if domain is not None:
                request.tenant = domain.tenant
                connection.set_tenant(request.tenant)
                return

            # The header was present but didn't resolve to any known
            # tenant -- fall through to the same public-schema fallback
            # used when no header is sent at all, rather than hard-404ing
            # the request. A client sending a stale or unrecognized
            # subdomain (e.g. after switching environments, or a bug like
            # sending this header on a shared/public endpoint that never
            # needed it) shouldn't be able to take down endpoints that
            # don't actually require tenant context. TenantViewSetMixin
            # separately enforces that genuine tenant endpoints require a
            # *valid* tenant, so this fallback doesn't grant access to
            # anything -- it just stops an irrelevant or bad header from
            # blocking public-schema requests.

        try:
            super().process_request(request)
        except Http404:
            # Fallback to public schema for API token, admin, reports, etc.
            TenantModel = get_tenant_model()

            try:
                public_tenant = TenantModel.objects.get(
                    schema_name=get_public_schema_name()
                )
            except TenantModel.DoesNotExist:
                raise Http404("Public tenant does not exist")

            request.tenant = public_tenant
            connection.set_tenant(public_tenant)
