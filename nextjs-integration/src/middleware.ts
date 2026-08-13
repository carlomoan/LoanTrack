import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
