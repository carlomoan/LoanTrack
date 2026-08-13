from django.contrib import admin
from .models import (
    Region, District, Ward, Street,
    Branch, LoanOfficer, Member, Loan,
    RepaymentSchedule, LoanAdjustment, LoanDocument
)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'district_count', 'created_at']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    
    def district_count(self, obj):
        return obj.districts.count()
    district_count.short_description = 'Districts'


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'region', 'ward_count', 'created_at']
    list_filter = ['region']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    
    def ward_count(self, obj):
        return obj.wards.count()
    ward_count.short_description = 'Wards'


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'district', 'geo_type', 'street_count', 'created_at']
    list_filter = ['district', 'geo_type']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    
    def street_count(self, obj):
        return obj.streets.count()
    street_count.short_description = 'Streets'


@admin.register(Street)
class StreetAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'ward', 'member_count', 'branch_count', 'created_at']
    list_filter = ['ward', 'ward__district', 'ward__district__region']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'
    
    def branch_count(self, obj):
        return obj.branches.count()
    branch_count.short_description = 'Branches'


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'street', 'manager_name', 'phone', 'email', 'is_active', 'created_at']
    list_filter = ['is_active', 'street__ward__district__region']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(LoanOfficer)
class LoanOfficerAdmin(admin.ModelAdmin):
    list_display = ['name', 'employee_id', 'phone', 'email', 'branch', 'is_active', 'created_at']
    list_filter = ['branch', 'is_active']
    search_fields = ['name', 'employee_id', 'phone']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ['member_id', 'name', 'gender', 'borrower_type', 'branch', 'loan_officer', 'street', 'beneficiaries', 'is_active', 'created_at']
    list_filter = ['gender', 'borrower_type', 'branch', 'loan_officer', 'is_active', 'street__ward__district__region']
    search_fields = ['member_id', 'name', 'national_id', 'phone', 'region_1', 'region_2', 'ward']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 50


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ['loan_number', 'member', 'product_type', 'status', 'loan_amount', 'outstanding_amount', 'disbursement_date', 'branch', 'loan_officer', 'is_deleted']
    list_filter = ['status', 'product_type', 'water_component', 'branch', 'loan_officer', 'disbursement_date', 'is_deleted']
    search_fields = ['loan_number', 'member__name', 'member__member_id']
    readonly_fields = ['created_at', 'updated_at', 'outstanding_amount']
    list_per_page = 50
    date_hierarchy = 'disbursement_date'
    
    fieldsets = (
        ('Loan Identification', {
            'fields': ('loan_number', 'member', 'branch', 'loan_officer')
        }),
        ('Loan Details', {
            'fields': ('product_type', 'disbursement_date', 'status', 'water_component')
        }),
        ('Financials', {
            'fields': ('interest_rate', 'loan_term', 'loan_amount', 'repaid_amount', 'outstanding_amount')
        }),
        ('Reporting', {
            'fields': ('last_report_date',)
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RepaymentSchedule)
class RepaymentScheduleAdmin(admin.ModelAdmin):
    list_display = ['loan', 'installment_number', 'due_date', 'expected_total', 'actual_paid', 'is_paid', 'days_overdue', 'is_overdue']
    list_filter = ['is_paid', 'loan__branch', 'loan__loan_officer', 'due_date']
    search_fields = ['loan__loan_number', 'loan__member__name']
    list_per_page = 50
    date_hierarchy = 'due_date'
    
    def is_overdue(self, obj):
        return obj.is_overdue
    is_overdue.boolean = True
    is_overdue.short_description = 'Overdue'


@admin.register(LoanAdjustment)
class LoanAdjustmentAdmin(admin.ModelAdmin):
    list_display = ['loan', 'adjustment_type', 'amount', 'is_approved', 'created_by', 'created_at', 'approved_by']
    list_filter = ['adjustment_type', 'is_approved', 'loan__branch']
    search_fields = ['loan__loan_number', 'reference_number', 'reason']
    readonly_fields = ['created_at', 'created_by', 'approved_by', 'approved_at']
    list_per_page = 50
    date_hierarchy = 'created_at'


@admin.register(LoanDocument)
class LoanDocumentAdmin(admin.ModelAdmin):
    list_display = ['loan', 'document_type', 'description', 'uploaded_by', 'uploaded_at']
    list_filter = ['document_type', 'loan__branch']
    search_fields = ['loan__loan_number', 'description']
    readonly_fields = ['uploaded_at', 'uploaded_by']
    list_per_page = 50
    date_hierarchy = 'uploaded_at'