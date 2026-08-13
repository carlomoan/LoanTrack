from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django_tenants.utils import get_tenant_model
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Core/shared API endpoints
    path("api/", include("core.urls")),

    # Tenant-specific API endpoints
    path("api/tenant/", include("tenants.urls")),

    # JWT authentication endpoints
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Add tenant-specific URLs dynamically
# This allows routing like /api/tenant/<schema_name>/...
TenantModel = get_tenant_model()
