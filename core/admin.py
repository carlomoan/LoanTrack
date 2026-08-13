from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import (
    Donor, AoM, GlobalUser, MFI, Domain,
    ExchangeRate, MFIReport, AoMReport, DonorReport
)


@admin.register(Donor)
class DonorAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact_email', 'contact_phone', 'base_currency', 'created_at']
    search_fields = ['name', 'contact_email']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AoM)
class AoMAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'donor', 'contact_email', 'created_at']
    list_filter = ['donor']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(GlobalUser)
class GlobalUserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'aom', 'donor', 'mfi', 'is_staff', 'is_active']
    list_filter = ['role', 'aom', 'donor', 'mfi', 'is_staff', 'is_active']
    search_fields = ['username', 'email']
    readonly_fields = ['date_joined', 'last_login']


@admin.register(MFI)
class MFIAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'code', 'schema_name', 'aom', 'donor', 'local_currency', 'is_active', 'is_onboarded', 'created_at']
    list_filter = ['aom', 'donor', 'is_active', 'is_onboarded']
    search_fields = ['name', 'code', 'schema_name', 'registration_number']
    readonly_fields = ['schema_name', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'code', 'schema_name')
        }),
        ('Registration', {
            'fields': ('registration_number', 'license_number')
        }),
        ('Contact', {
            'fields': ('email', 'phone', 'address')
        }),
        ('Currency', {
            'fields': ('local_currency',)
        }),
        ('Relationships', {
            'fields': ('aom', 'donor')
        }),
        ('Status', {
            'fields': ('is_active', 'is_onboarded')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ['domain', 'tenant', 'is_primary']
    list_filter = ['is_primary']
    search_fields = ['domain']


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['from_currency', 'to_currency', 'rate', 'date', 'source', 'created_at']
    list_filter = ['from_currency', 'to_currency', 'source', 'date']
    search_fields = ['from_currency', 'to_currency']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'date'


@admin.register(MFIReport)
class MFIReportAdmin(admin.ModelAdmin):
    list_display = ['mfi', 'period', 'status', 'local_currency', 'base_currency', 'exchange_rate', 'submitted_at']
    list_filter = ['status', 'mfi__aom', 'mfi__donor', 'period']
    search_fields = ['mfi__name', 'mfi__code']
    readonly_fields = ['generated_at', 'submitted_at', 'approved_at', 'generated_by', 'approved_by']
    date_hierarchy = 'period'


@admin.register(AoMReport)
class AoMReportAdmin(admin.ModelAdmin):
    list_display = ['aom', 'period', 'status', 'base_currency', 'generated_at']
    list_filter = ['status', 'aom__donor', 'period']
    search_fields = ['aom__name', 'aom__code']
    readonly_fields = ['generated_at', 'approved_at', 'generated_by', 'approved_by']
    date_hierarchy = 'period'


@admin.register(DonorReport)
class DonorReportAdmin(admin.ModelAdmin):
    list_display = ['donor', 'period', 'status', 'base_currency', 'generated_at']
    list_filter = ['status', 'donor', 'period']
    search_fields = ['donor__name']
    readonly_fields = ['generated_at', 'approved_at', 'generated_by', 'approved_by']
    date_hierarchy = 'period'