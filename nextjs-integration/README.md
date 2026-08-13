# LoanTrack Next.js Frontend

This directory contains the Next.js frontend integration for the LoanTrack multi-tenant MFI loan management system.

## Overview

The frontend provides a modern React/Next.js interface for managing microfinance institutions (MFIs), including:

- **Multi-tenant authentication** with JWT and subdomain routing
- **CRUD operations** for all loan management entities
- **Cascading dropdowns** for normalized geography (Region → District → Ward → Street)
- **CSV import** functionality for bulk data entry
- **Financial reporting** with charts and analytics
- **Audit trails** and loan adjustments
- **Real-time updates** via React Query

## Project Structure

```
nextjs-integration/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── login/             # Login page
│   │   ├── dashboard/         # Main dashboard
│   │   ├── branches/          # Branches management
│   │   ├── loan-officers/     # Loan officers management
│   │   ├── members/           # Members management
│   │   ├── loans/             # Loans management
│   │   ├── repayment-schedules/ # Repayment schedules
│   │   ├── loan-adjustments/   # Loan adjustments
│   │   ├── loan-documents/    # Loan documents
│   │   ├── import/            # CSV import
│   │   └── reports/            # Reports & analytics
│   ├── api/                   # API client configuration
│   ├── components/            # UI components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── forms/            # Form components
│   │   └── tables/           # Data table components
│   ├── hooks/                 # React Query hooks
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── package.json
├── next.config.js
└── tsconfig.json
```

## Key Features

### 1. Multi-Tenant Architecture

- **Subdomain-based routing**: MFIs access their data via subdomains (e.g., `andrew-bio.localhost`)
- **Edge middleware**: Automatically extracts subdomain and passes it as `X-Tenant-Subdomain` header
- **JWT authentication**: Secure token-based auth with refresh token handling
- **Role-based access control**: Different permissions for MFIs, AoMs, Donors, and admins

### 2. Modern React Stack

- **Next.js 14** with App Router
- **React Query** for server state management and caching
- **Zustand** for auth and UI state
- **TypeScript** for type safety
- **Tailwind CSS** with shadcn/ui components
- **Recharts** for financial visualizations

### 3. FinTech-Grade Features

- **Audit trails**: Full history tracking for all loan operations
- **Amortization schedules**: Automated repayment calculations
- **Loan adjustments**: Principal/interest modifications with approvals
- **Document management**: File uploads for receipts and agreements
- **Soft deletion**: Archive instead of delete for compliance
- **Currency conversion**: Multi-currency reporting support

### 4. Rich User Experience

- **Cascading dropdowns**: Dynamic geography selection
- **Form validation**: Zod schema validation with real-time feedback
- **Data tables**: Sortable, filterable with pagination
- **Financial charts**: Portfolio health, trends, and analytics
- **Real-time updates**: WebSocket-like updates via polling
- **Responsive design**: Works on desktop and mobile

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database with schema isolation support
- Redis for caching and Celery

### Installation

```bash
cd nextjs-integration
npm install
```

### Environment Variables

Create `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_TENANT_SUBDOMAIN=andrew-bio

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
```

### Running the Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## API Integration

The frontend communicates with the Django backend via the `api/client.ts` file, which:

- Automatically includes JWT tokens in requests
- Adds tenant subdomain headers for multi-tenancy
- Handles token refresh transparently
- Provides helper functions for common operations

### Authentication Flow

1. User logs in via `/login` page
2. Next.js middleware extracts subdomain from hostname
3. API client includes `X-Tenant-Subdomain` header
4. JWT token is automatically attached to all requests
5. Token refresh is handled transparently

### Data Fetching

All data fetching uses React Query hooks:

```typescript
import { useLoans, useCreateLoan } from '@/hooks/useLoans';

const { data: loans, isLoading } = useLoans({ page: 1, pageSize: 10 });
```

## Components

### UI Components

- **Card**: Container component with header, content, and footer
- **Button**: Styled button with variants and sizes
- **Input**: Form input with validation styling
- **Select**: Dropdown with search and filtering
- **Toast**: Notification system with rich colors

### Form Components

- **LocationSelector**: Cascading geography dropdowns
- **AdjustmentForm**: Loan adjustment with file upload
- **LoanForm**: Complete loan creation/editing form

### Data Tables

- **LoansTable**: Display loans with overdue highlighting
- **MembersTable**: Member management with search
- **GeographyTable**: Region/district/ward/street management

## Development

### Code Quality

- **TypeScript**: Strict mode with proper type definitions
- **ESLint**: Code linting with Next.js rules
- **Prettier**: Code formatting
- **Husky**: Git hook management

### Testing

The project includes comprehensive TypeScript definitions and follows best practices for:

- **Type safety**: Full type coverage with strict checking
- **Component testing**: React components with proper props validation
- **API integration**: Type-safe API client with proper error handling
- **State management**: Consistent state patterns across the application

## Deployment

### Docker Deployment

```bash
docker-compose -f docker-compose.frontend.yml up -d
```

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

The frontend uses these main API endpoints:

- **Authentication**: `/api/token/`, `/api/token/refresh/`
- **Tenant APIs**: `/api/tenant/` (all tenant-specific operations)
- **Shared APIs**: `/api/` (global operations for Donors, AoMs)
- **Cross-tenant**: `/api/tenant/public/cross-tenant/` (consolidated reports)

## Customization

### Adding New Features

1. **New API endpoints**: Add to `api/tenant.ts` or `api/shared.ts`
2. **New React Query hooks**: Add to `hooks/use*.ts`
3. **New UI components**: Add to `components/`
4. **New pages**: Add to `app/` directory

### Theme Customization

The UI uses Tailwind CSS with shadcn/ui components. Customize:

- **Colors**: Update `tailwind.config.js`
- **Fonts**: Update `globals.css`
- **Component styles**: Modify `components/ui/*.tsx` files

## Troubleshooting

### Common Issues

1. **Subdomain not working**: Check middleware configuration and hostname extraction
2. **Authentication errors**: Verify JWT token storage and refresh logic
3. **API requests failing**: Check CORS configuration and API base URL
4. **TypeScript errors**: Run `npm run lint` and fix type issues
5. **Build failures**: Check environment variables and dependencies

### Development Tips

- Use `npm run dev` for development with hot reload
- Use `npm run build` for production builds
- Use `npm run lint` for code quality checks
- Check browser console for API errors
- Use React Query Devtools for debugging

## Support

For issues and support, refer to the main LoanTrack documentation or contact the development team.

---

This Next.js frontend provides a comprehensive, production-ready interface for managing microfinance institutions with robust multi-tenant architecture and FinTech-grade features.