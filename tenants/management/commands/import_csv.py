import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django_tenants.utils import schema_context, get_tenant_model

from tenants.models import (
    Branch, LoanOfficer, Member, Loan,
    Region, District, Ward, Street
)


class Command(BaseCommand):
    help = 'Import CSV data for a specific tenant (MFI) with normalized geography'

    def add_arguments(self, parser):
        parser.add_argument('tenant_schema', type=str, help='Tenant schema name (e.g., tenant_andrew_bio)')
        parser.add_argument('csv_file', type=str, help='Path to CSV file')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Parse CSV but do not save to database',
        )
        parser.add_argument(
            '--skip-headers',
            action='store_true',
            default=True,
            help='Skip first row as headers',
        )
        parser.add_argument(
            '--async',
            action='store_true',
            dest='async_import',
            help='Run import asynchronously via Celery',
        )

    def handle(self, *args, **options):
        tenant_schema = options['tenant_schema']
        csv_file_path = options['csv_file']
        dry_run = options['dry_run']
        skip_headers = options['skip_headers']
        async_import = options['async_import']

        # Verify tenant exists
        TenantModel = get_tenant_model()
        try:
            tenant = TenantModel.objects.get(schema_name=tenant_schema)
        except TenantModel.DoesNotExist:
            raise CommandError(f'Tenant with schema "{tenant_schema}" does not exist')

        self.stdout.write(f'Importing CSV for tenant: {tenant.name} ({tenant_schema})')

        if async_import:
            # Queue async task
            from tenants.tasks import import_csv_async
            task = import_csv_async.delay(tenant_schema, csv_file_path)
            self.stdout.write(self.style.SUCCESS(f'Import queued as async task: {task.id}'))
            return

        # Process CSV within tenant schema context
        with schema_context(tenant_schema):
            stats = self.import_csv(csv_file_path, skip_headers, dry_run)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No data saved'))
        
        self.stdout.write(self.style.SUCCESS(
            f'Import complete: {stats["branches"]} branches, '
            f'{stats["officers"]} loan officers, '
            f'{stats["members"]} members, '
            f'{stats["loans"]} loans, '
            f'{stats["regions"]} regions, '
            f'{stats["districts"]} districts, '
            f'{stats["wards"]} wards, '
            f'{stats["streets"]} streets'
        ))

    def import_csv(self, csv_file_path, skip_headers, dry_run):
        stats = {
            'branches': 0, 'officers': 0, 'members': 0, 'loans': 0,
            'regions': 0, 'districts': 0, 'wards': 0, 'streets': 0,
            'errors': 0
        }
        
        with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            if skip_headers:
                # DictReader already skips headers
                pass
            
            for row_num, row in enumerate(reader, start=1):
                try:
                    with transaction.atomic():
                        self.process_row(row, stats, dry_run)
                except Exception as e:
                    stats['errors'] += 1
                    self.stdout.write(
                        self.style.ERROR(f'Row {row_num}: {e}')
                    )
                    if not dry_run:
                        raise

        return stats

    def process_row(self, row, stats, dry_run):
        # Clean row data - strip whitespace
        row = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
        
        # 1. Get or create Branch
        branch_name = row.get('Branch Name', '').strip()
        if not branch_name:
            raise ValueError('Missing Branch Name')
        
        branch, branch_created = Branch.objects.get_or_create(
            name=branch_name,
            defaults={
                'code': self.generate_code(branch_name),
                'address': '',
            }
        )
        if branch_created:
            stats['branches'] += 1

        # 2. Get or create Loan Officer
        officer_name = row.get('Loan Officer Name', '').strip()
        officer_phone = row.get('Phone Number', '').strip()
        
        if officer_name:
            officer, officer_created = LoanOfficer.objects.get_or_create(
                name=officer_name,
                defaults={
                    'phone': officer_phone,
                    'employee_id': self.generate_employee_id(officer_name),
                    'branch': branch,
                }
            )
            # Update phone if provided and different
            if officer_phone and officer.phone != officer_phone:
                officer.phone = officer_phone
                officer.save(update_fields=['phone'])
            if officer_created:
                stats['officers'] += 1
        else:
            officer = None

        # 3. Create normalized geography hierarchy
        region_1 = row.get('Region 1', '').strip()
        region_2 = row.get('Region 2', '').strip()
        ward_name = row.get('Ward', '').strip()
        street_name = row.get('Street', '').strip()
        geo_type = row.get('Geographical Type', '').strip()
        
        street = None
        if region_1 and region_2 and ward_name and street_name:
            street = self.get_or_create_geography(
                region_1, region_2, ward_name, street_name, geo_type, stats
            )

        # 4. Get or create Member
        member_name = row.get('Borrowers Name', '').strip()
        if not member_name:
            raise ValueError('Missing Borrowers Name')
        
        # Generate member_id from name + region
        member_id = self.generate_member_id(member_name, region_1, region_2)
        
        member, member_created = Member.objects.get_or_create(
            member_id=member_id,
            defaults={
                'name': member_name,
                'gender': row.get('Borrowers Gender', 'M').strip()[:1].upper(),
                'borrower_type': row.get('Borrowers Type', 'IND').strip()[:3].upper(),
                'region_1': region_1,  # Legacy field
                'region_2': region_2,  # Legacy field
                'ward': ward_name,     # Legacy field
                'street_name': street_name,  # Legacy field
                'geo_type': geo_type,  # Legacy field
                'beneficiaries': self.parse_int(row.get('Number of beneficieries', 1)),
                'branch': branch,
                'loan_officer': officer,
                'street': street,  # Normalized FK
            }
        )
        if member_created:
            stats['members'] += 1

        # 5. Create Loan
        loan_number = row.get('Loan Number', '').strip()
        if not loan_number:
            raise ValueError('Missing Loan Number')
        
        # Check if loan already exists
        if Loan.objects.filter(loan_number=loan_number).exists():
            self.stdout.write(f'Loan {loan_number} already exists, skipping')
            return

        loan_data = {
            'loan_number': loan_number,
            'member': member,
            'branch': branch,
            'loan_officer': officer,
            'product_type': row.get('Product Type', '').strip(),
            'disbursement_date': self.parse_date(row.get('Disbursment Date', '')),
            'status': row.get('Loan status', 'PND').strip()[:3].upper(),
            'water_component': self.parse_bool(row.get('Water Component', '')),
            'interest_rate': self.parse_decimal(row.get('Interest', 0)),
            'loan_term': self.parse_int(row.get('Loan Term', 0)),
            'loan_amount': self.parse_decimal(row.get('Loan Amount', 0)),
            'repaid_amount': self.parse_decimal(row.get('Repaid Amount', 0)),
        }
        
        if not dry_run:
            Loan.objects.create(**loan_data)
        stats['loans'] += 1

    def get_or_create_geography(self, region_name, district_name, ward_name, street_name, geo_type, stats):
        """Create normalized geography hierarchy from CSV data"""
        # Map geo_type string to Ward.GeoType
        geo_type_map = {
            'urban': Ward.GeoType.URBAN,
            'rural': Ward.GeoType.RURAL,
            'peri-urban': Ward.GeoType.PERI_URBAN,
            'peri_urban': Ward.GeoType.PERI_URBAN,
        }
        ward_geo_type = geo_type_map.get(geo_type.lower(), Ward.GeoType.RURAL)
        
        # Region
        region, region_created = Region.objects.get_or_create(
            name=region_name,
            defaults={'code': self.generate_code(region_name)}
        )
        if region_created:
            stats['regions'] += 1
        
        # District
        district, district_created = District.objects.get_or_create(
            region=region,
            name=district_name,
            defaults={'code': self.generate_code(district_name)}
        )
        if district_created:
            stats['districts'] += 1
        
        # Ward
        ward, ward_created = Ward.objects.get_or_create(
            district=district,
            name=ward_name,
            defaults={'geo_type': ward_geo_type, 'code': self.generate_code(ward_name)}
        )
        if ward_created:
            stats['wards'] += 1
        
        # Street
        street, street_created = Street.objects.get_or_create(
            ward=ward,
            name=street_name,
            defaults={'code': self.generate_code(street_name)}
        )
        if street_created:
            stats['streets'] += 1
        
        return street

    def generate_code(self, name):
        """Generate a short code from name"""
        code = ''.join(c.upper() for c in name if c.isalnum())[:20]
        base_code = code
        counter = 1
        while Branch.objects.filter(code=code).exists():
            code = f"{base_code}{counter}"
            counter += 1
        return code

    def generate_employee_id(self, name):
        """Generate employee ID from name"""
        base = ''.join(c.upper() for c in name if c.isalnum())[:10]
        counter = 1
        emp_id = base
        while LoanOfficer.objects.filter(employee_id=emp_id).exists():
            emp_id = f"{base}{counter}"
            counter += 1
        return emp_id

    def generate_member_id(self, name, region_1, region_2):
        """Generate unique member ID"""
        base = ''.join(c.upper() for c in name if c.isalnum())[:15]
        region_part = ''.join(c.upper() for c in (region_1 + region_2) if c.isalnum())[:10]
        member_id = f"{base}_{region_part}"[:50]
        
        counter = 1
        original = member_id
        while Member.objects.filter(member_id=member_id).exists():
            member_id = f"{original}_{counter}"
            counter += 1
        return member_id

    def parse_date(self, date_str):
        """Parse date from various formats"""
        if not date_str:
            return None
        
        formats = [
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%d-%m-%Y',
            '%m/%d/%Y',
            '%Y/%m/%d',
            '%d.%m.%Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f'Unable to parse date: {date_str}')

    def parse_decimal(self, value):
        """Parse decimal value"""
        if value is None or value == '':
            return Decimal('0')
        try:
            return Decimal(str(value).replace(',', ''))
        except (InvalidOperation, ValueError):
            return Decimal('0')

    def parse_int(self, value):
        """Parse integer value"""
        if value is None or value == '':
            return 0
        try:
            return int(float(str(value).replace(',', '')))
        except (ValueError, TypeError):
            return 0

    def parse_bool(self, value):
        """Parse boolean value"""
        if not value:
            return False
        val = str(value).strip().lower()
        return val in ('yes', 'true', '1', 'y', 't')