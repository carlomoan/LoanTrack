from django.apps import AppConfig


class TenantsConfig(AppConfig):
    name = 'tenants'
    verbose_name = 'Tenants (Isolated)'

    def ready(self):
        # Import signals
        import tenants.signals  # noqa