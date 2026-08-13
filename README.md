# LoanTrack - Multi-Tenant MFI Loan Management System

A Django-based multi-tenant SaaS platform for Microfinance Institutions (MFIs) to manage loans, members, and reporting. Built with `django-tenants` for PostgreSQL schema-based isolation.

## Architecture

### Multi-Tenant Schema Strategy

- **Shared App (Public Schema)**: Global data - Donors, AoMs, MFI registrations, Global Users
- **Tenant App (Isolated Schemas)**: MFI-specific data - Branches, Loan Officers, Members, Loans

When an Admin creates an MFI, the system automatically creates a new PostgreSQL schema (e.g., `tenant_andrew_bio`) and runs migrations for that schema.

## Models

### Shared Models (Public Schema)
- **Donor** - Global donors who fund MFIs
- **AoM** - Association of Microfinance (regional/national bodies)
- **GlobalUser** - Super admins, AoM staff, Donor staff, MFI Admin, MFI Manager, Loan Officer
- **MFI** - Microfinance Institution (tenant model)
- **Domain** - Domain mapping for tenant routing
- **ExchangeRate** - Currency conversion rates
- **MFIReport** - Monthly reports submitted by MFIs
- **AoMReport** - Consolidated reports for AoMs
- **DonorReport** - Consolidated reports for Donors

### Tenant Models (Isolated Schemas)

#### Normalized Geography
- **Region** - Top-level geographic region
- **District** - District within a region
- **Ward** - Ward within a district (with geo_type: Urban/Rural/Peri-Urban)
- **Street** - Street within a ward

#### Core Business Models
- **Branch** - MFI branches (linked to Street)
- **LoanOfficer** - Loan officers with phone/email
- **Member** - Borrowers with normalized geography (FK to Street) + legacy fields for CSV compatibility
- **Loan** - Loan records with financial tracking
- **RepaymentSchedule** - Amortization schedule with expected/actual payments
- **LoanAdjustment** - Manual adjustments with audit trail and supporting documents
- **LoanDocument** - Document attachments (receipts, agreements, ID docs)

## FinTech-Grade Features Implemented

| Feature | Implementation |
|---------|----------------|
| **Audit Trail** | `django-simple-history` on all models - full history with user/timestamp |
| **Amortization** | `RepaymentSchedule` model with expected/actual payments, overdue tracking |
| **Loan Adjustments** | `LoanAdjustment` with types (Principal Reduction, Write-off, etc.), approval workflow, file uploads |
| **Document Management** | `LoanDocument` for receipts, agreements, ID docs, collateral |
| **Soft Deletion** | `is_deleted`/`deleted_at` on Loan with custom manager |
| **Cross-Tenant Reporting** | MFI→AoM→Donor consolidation with currency conversion |
| **Redis Caching** | Report caching (1hr MFI, 30min cross-tenant) |
| **Celery Tasks** | Async CSV import, monthly reports, nightly overdue updates |
| **RBAC** | 6 roles with branch-level permissions |
| **Rate Limiting** | Throttling: anon 100/day, user 1000/hr, donor 100/hr |
| **JWT Auth** | Access/refresh tokens with rotation |

## CSV Import

```bash
python manage.py import_csv <tenant_schema> <csv_file_path>
```

### CSV Column Mapping

| CSV Column | Database Action |
|------------|-----------------|
| Branch Name | Check/create Branch in tenant schema |
| Loan Officer Name + Phone Number | Split into name/phone, check/create LoanOfficer |
| Borrowers Name, Gender, Type, Regions, Ward, Street, Geo, Beneficiaries | Check/create Member by name/region + create normalized geography |
| Loan Number, Product Type, Disbursement Date, Status, Water Component, Interest, Loan Term | Create Loan linked to Member, Branch, Officer |

### Options
- `--dry-run` - Parse without saving
- `--skip-headers` - Skip first row (default: True)
- `--async` - Queue import as Celery task

## API Endpoints

### Shared (Public Schema)
- `GET/POST /api/donors/` - Donor management
- `GET/POST /api/aoms/` - AoM management
- `GET/POST /api/mfis/` - MFI registration & schema creation
- `GET/POST /api/domains/` - Domain management
- `GET/POST /api/users/` - Global user management
- `GET/POST /api/exchange-rates/` - Exchange rate management
- `GET/POST /api/mfi-reports/` - MFI report management
- `GET/POST /api/aom-reports/` - AoM report management
- `GET/POST /api/donor-reports/` - Donor report management

### Tenant (Isolated Schema)

#### Geography (cascading dropdowns)
- `GET/POST /api/tenant/regions/`
- `GET/POST /api/tenant/districts/?region=1`
- `GET/POST /api/tenant/wards/?district=1`
- `GET/POST /api/tenant/streets/?ward=1`

#### Core Business
- `GET/POST /api/tenant/branches/`
- `GET/POST /api/tenant/loan-officers/`
- `GET/POST /api/tenant/members/`
- `GET/POST /api/tenant/loans/`
- `GET/POST /api/tenant/repayment-schedules/`
- `GET/POST /api/tenant/loan-adjustments/`
- `GET/POST /api/tenant/loan-documents/`

#### Loan Actions
- `POST /api/tenant/loans/{id}/soft_delete/` - Archive loan
- `POST /api/tenant/loans/{id}/restore/` - Restore loan
- `GET /api/tenant/loans/{id}/history/` - Audit trail
- `POST /api/tenant/loans/{id}/generate_schedule/` - Create amortization schedule

#### Repayment Schedule
- `POST /api/tenant/repayment-schedules/{id}/record_payment/` - Record payment
- `GET /api/tenant/repayment-schedules/overdue/` - Get overdue items

#### Loan Adjustments
- `POST /api/tenant/loan-adjustments/{id}/approve/` - Approve & apply adjustment

#### Reporting
- `GET /api/tenant/reports/portfolio_summary/` - Complete portfolio with PAR
- `GET /api/tenant/reports/monthly_trends/` - Monthly disbursement trends
- `POST /api/tenant/reports/generate_mfi_report/` - Submit monthly report

#### Cross-Tenant (Public Schema)
- `GET /api/tenant/public/cross-tenant/mfi_reports/` - List MFI reports
- `POST /api/tenant/public/cross-tenant/generate_aom_report/` - Consolidate for AoM
- `POST /api/tenant/public/cross-tenant/generate_donor_report/` - Consolidate for Donor
- `GET /api/tenant/public/cross-tenant/cached_report/` - Get cached report from Redis

## Setup

### Local Development

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure PostgreSQL**:
   - Create database `loantrack`
   - Copy `.env.example` to `.env` and update values

3. **Run migrations**:
   ```bash
   python manage.py migrate_schemas --shared
   ```

4. **Create superuser**:
   ```bash
   python manage.py createsuperuser
   ```

5. **Run server**:
   ```bash
   python manage.py runserver
   ```

### Docker Deployment

```bash
docker-compose up -d
```

Starts: PostgreSQL (5432), Redis (6379), Django (8000), Celery worker, Celery beat

## Creating a New MFI (Tenant)

```bash
POST /api/mfis/
{
    "name": "Andrew Bio TAMFI",
    "registration_number": "MFI-001",
    "email": "admin@andrewbio.tz",
    "phone": "+255123456789",
    "address": "Dar es Salaam, Tanzania",
    "aom": 1,
    "donor": 1,
    "local_currency": "TZS"
}
```

Automatically:
1. Creates MFI in public schema
2. Creates PostgreSQL schema `tenant_andrew_bio`
3. Runs tenant migrations
4. Creates default admin user in tenant schema
5. Creates default geography + branch/officer
6. MFI can now import CSV data

## Next.js Frontend Integration

A complete Next.js integration is available in `nextjs-integration/` with:
- TypeScript types for all models
- Axios client with JWT auth & token refresh
- React Query hooks for all endpoints
- Zustand stores for auth, geography, report filters
- Cascading geography dropdowns
- Multi-tenant header injection via Edge Middleware

```bash
cd nextjs-integration
npm install
cp .env.example .env.local
npm run dev
```

### Multi-Tenant Subdomain Middleware

Next.js Edge Middleware intercepts requests to extract the MFI subdomain (e.g., andrew-bio.localhost:3000) and passes it as a header to your API client.

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Ignore standard domains (e.g., your main marketing site)
  if (['localhost', 'www', 'app'].includes(subdomain)) {
    return NextResponse.next();
  }

  // If it's an MFI subdomain, attach it to the request headers
  if (subdomain) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Tenant-Subdomain', subdomain);
    
    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
}
```

### API Client & Auth Setup

Configure Axios to automatically include the tenant header and JWT token.

```typescript
// lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});

// Intercept requests to attach Tenant Subdomain and Auth Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'www') {
      config.headers['X-Tenant-Subdomain'] = subdomain;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
```

### Data Fetching with TanStack Query

TanStack Query handles caching, background updates, and loading states.

```typescript
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

```typescript
// app/layout.tsx
import { Providers } from './providers';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Cascading Dropdowns (Normalized Geography)

When creating a Member, if a user selects a Region, the District dropdown should automatically fetch only districts in that region.

```typescript
// components/forms/LocationSelector.tsx
'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function LocationSelector({ onLocationChange }: { onLocationChange: (field: string, value: string) => void }) {
  const [regionId, setRegionId] = useState<string>('');
  const [districtId, setDistrictId] = useState<string>('');

  // Fetch Regions
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => api.get('/regions/').then(res => res.data),
  });

  // Fetch Districts based on selected Region
  const { data: districts } = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => api.get(`/districts/?region=${regionId}`).then(res => res.data),
    enabled: !!regionId, // Only run query if regionId is selected
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium">Region</label>
        <Select onValueChange={(v) => { setRegionId(v); onLocationChange('region', v); }}>
          <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
          <SelectContent>
            {regions?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label className="text-sm font-medium">District</label>
        <Select onValueChange={(v) => { setDistrictId(v); onLocationChange('district', v); }} disabled={!regionId}>
          <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
          <SelectContent>
            {districts?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

### File Uploads (Accounting Adjustments)

Uploading a receipt requires FormData. Notice the Content-Type: multipart/form-data header.

```typescript
// components/forms/AdjustmentForm.tsx
'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function AdjustmentForm({ loanId }: { loanId: number }) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Please attach a receipt.');

    setLoading(true);
    const formData = new FormData();
    formData.append('loan', String(loanId));
    formData.append('adjustment_type', 'RPY');
    formData.append('amount', amount);
    formData.append('attachment', file);

    try {
      await api.post('/loan-adjustments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Repayment recorded successfully!');
    } catch (err) {
      toast.error('Failed to upload adjustment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input type="number" placeholder="Amount Paid" onChange={e => setAmount(e.target.value)} required />
      <Input type="file" accept=".pdf,.png,.jpg" onChange={e => setFile(e.target.files?.[0] || null)} required />
      <Button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Submit Repayment'}</Button>
    </form>
  );
}
```

### Donor / AoM Dashboard (Financial Charts)

Uses Recharts to visualize the JSON payload returned by the Django Redis-cached endpoint.

```typescript
// app/dashboard/page.tsx
    name: mfi.mfi_name,
    disbursed: parseFloat(mfi.accounting.total_disbursed_usd),
  })) || [];

  const parData = [
    { name: 'Healthy Portfolio', value: 100 - parseFloat(data.accounting?.portfolio_at_risk?.par_ratio_percent || 0) },
    { name: 'At Risk (PAR)', value: parseFloat(data.accounting?.portfolio_at_risk?.par_ratio_percent || 0) }
  ];

  const COLORS = ['#10b981', '#ef4444'];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">AoM Consolidated Donor Report</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Disbursed (USD)" value={`$${data.accounting?.total_disbursed_usd}`} />
        <Card title="Active Loans" value={data.total_active_loans} />
        <Card title="Portfolio at Risk" value={`${data.accounting?.portfolio_at_risk?.par_ratio_percent}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">MFI Disbursement Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mfiPerformance}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="disbursed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Portfolio Health</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={parData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {parData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
```

### Loans Data Table (Overdue Highlighting)

Uses standard HTML tables styled with Tailwind. Rows turn red if days_overdue > 0 based on the Celery background task.

```typescript
// components/tables/LoansTable.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function LoansTable() {
  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => api.get('/loans/').then(res => res.data),
  });

  if (isLoading) return <div>Loading loans...</div>;

  return (
    <div className="bg-white rounded-lg shadow border overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-600 uppercase">
          <tr>
            <th className="p-4">Loan #</th>
            <th className="p-4">Member</th>
            <th className="p-4">Disbursed</th>
            <th className="p-4">Outstanding</th>
            <th className="p-4">Schedule Status</th>
          </tr>
        </thead>
        <tbody>
          {loans?.map((loan: any) => {
            // Check if any schedule installment is overdue
            const hasOverdue = loan.schedule?.some((s: any) => s.days_overdue > 0);
            
            return (
              <tr key={loan.id} className={`border-b hover:bg-gray-50 ${hasOverdue ? 'bg-red-50' : ''}`}>                <td className="p-4 font-medium">{loan.loan_number}</td>
                <td className="p-4">{loan.member.name}</td>
                <td className="p-4">${loan.loan_amount}</td>
                <td className="p-4 text-red-600 font-semibold">${loan.outstanding_amount}</td>
                <td className="p-4">
                  {hasOverdue ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">OVERDUE</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">ON TRACK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

### Tenant Resolution

In your Next.js frontend, extract the subdomain from the URL and pass it as a header to API requests:

```javascript
headers: {
  'X-Tenant-Subdomain': 'andrew-bio',
  'Authorization': 'Bearer <jwt_token>'
}
```

### Cascading Dropdowns

```javascript
const regions = await fetch('/api/tenant/regions/')
const districts = await fetch(`/api/tenant/districts/?region=${regionId}`)
const wards = await fetch(`/api/tenant/wards/?district=${districtId}`)
const streets = await fetch(`/api/tenant/streets/?ward=${wardId}`)
```

### Authentication

```javascript
const response = await fetch('/api/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
})
const { access, refresh } = await response.json()
// Use: headers: { 'Authorization': `Bearer ${access}` }
```

## Cross-Schema Reporting

```python
from django_tenants.utils import get_tenant_model, schema_context
from tenants.tasks import generate_cross_tenant_report

# Async cross-tenant report
task = generate_cross_tenant_report.delay(aom_id=1)
result = task.get()

# Manual aggregation
for tenant in MFI.objects.filter(aom_id=1):
    with schema_context(tenant.schema_name):
        loans = Loan.objects.all()
```

## Celery Tasks

- `generate_monthly_mfi_report(mfi_schema_name)` - Cached monthly report
- `generate_cross_tenant_report(aom_id, donor_id)` - Consolidated report
- `import_csv_async(tenant_schema, csv_file_path)` - Async CSV import
- `update_overdue_schedules()` - Nightly overdue update
- `generate_all_mfi_reports(period_str)` - Batch report generation

```bash
celery -A loantrack worker -l info
celery -A loantrack beat -l info
```

## Project Structure

```
LoanTrack/
├── core/                 # Shared app (public schema)
│   ├── models.py         # Donor, AoM, GlobalUser, MFI, Domain, ExchangeRate, Reports
│   ├── views.py          # Shared API views
│   ├── serializers.py    # Shared serializers
│   ├── admin.py          # Admin configuration
│   ├── middleware.py     # Header-based tenant resolution
│   ├── signals.py        # Post-save signals for tenant setup
│   └── urls.py           # Shared API routes
├── tenants/              # Tenant app (isolated schemas)
│   ├── models.py         # Geography, Branch, LoanOfficer, Member, Loan, Schedule, Adjustment, Document
│   ├── views.py          # Tenant API views + reporting
│   ├── serializers.py    # Tenant serializers with nested geography
│   ├── admin.py          # Admin configuration
│   ├── tasks.py          # Celery tasks for reporting & imports
│   └── management/
│       └── commands/
│           └── import_csv.py  # CSV import command
├── nextjs-integration/   # Next.js frontend integration
│   ├── src/
│   │   ├── types/        # TypeScript definitions
│   │   ├── api/          # Axios client & endpoints
│   │   ├── hooks/        # React Query hooks & Zustand stores
│   │   ├── components/   # Reusable UI components
│   │   └── utils/        # Helper functions
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
└── loantrack/            # Project settings
    ├── settings.py       # Multi-tenant configuration
    ├── urls.py           # URL routing
    └── celery.py         # Celery configuration
```

## Key Features

- **Zero Data Bleed**: PostgreSQL schema isolation ensures complete data separation
- **Automated SaaS Creation**: New MFI = new schema + migrations + default data automatically
- **Normalized Geography**: Region → District → Ward → Street hierarchy for data integrity
- **CSV Import**: Robust import with deduplication and normalized geography creation
- **Async Processing**: Celery + Redis for heavy reports and imports
- **Caching**: Redis caching for fast dashboard loads
- **JWT Auth**: Secure token-based authentication for Next.js
- **Header-based Tenant Resolution**: Works with Next.js subdomain routing
- **Comprehensive Reporting**: Portfolio, geographic, WSS, PAR, and cross-tenant reports
- **Audit Trail**: Full history on all models via django-simple-history
- **Amortization**: Repayment schedules with overdue tracking
- **Adjustments**: Manual corrections with approval workflow and documents
- **Soft Deletion**: Archive instead of delete for audit compliance
- **Currency Conversion**: Exchange rates for multi-currency reporting
- **Rate Limiting**: API throttling for security
- **Next.js Ready**: REST API with CORS, cascading dropdowns, JWT auth