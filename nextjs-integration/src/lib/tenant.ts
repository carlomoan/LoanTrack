const PUBLIC_HOSTS = ['localhost', '127.0.0.1', 'www', 'app'];

export function getTenantSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  if (!hostname) return null;

  const parts = hostname.split('.');
  if (parts.length < 2) return null;

  const subdomain = parts[0];

  if (!subdomain || PUBLIC_HOSTS.includes(subdomain)) {
    return null;
  }

  return subdomain;
}

export function normalizeTenantSubdomain(value?: string | null): string | null {
  if (!value) return null;

  const cleaned = value.trim().toLowerCase();

  if (!cleaned) return null;
  if (PUBLIC_HOSTS.includes(cleaned)) return null;

  return cleaned.split('.')[0];
}

export function schemaNameToSubdomain(schemaName?: string | null): string | null {
  if (!schemaName) return null;

  return normalizeTenantSubdomain(schemaName.replace(/^tenant_/, ''));
}
