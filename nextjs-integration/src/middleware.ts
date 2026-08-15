import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// NOTE: this only affects the Next.js *page* request/response cycle. The
// browser's axios calls in src/api/client.ts go straight to
// NEXT_PUBLIC_API_URL (the Django backend), not through this middleware,
// so the X-Tenant-Subdomain header set here never reaches the API. Real
// tenant resolution for API calls lives in
// src/api/client.ts:resolveTenantSubdomain, driven by the logged-in
// user's own mfi_schema. This middleware would only matter if a Next.js
// API route/proxy were added later.
export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  if (['localhost', 'www', 'app', '127.0.0.1'].includes(subdomain)) {
    return NextResponse.next();
  }

  if (subdomain) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Tenant-Subdomain', subdomain);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = { matcher: '/:path*' }
