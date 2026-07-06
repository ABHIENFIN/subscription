import { Request } from 'express';
import { BadRequestException } from './exceptions';

const TENANT_HEADER = 'x-tenant-id';

/**
 * Resolves the tenantId for the current request.
 *
 * Priority:
 *   1. X-Tenant-Id header (always wins, even over req.tenantId set by middleware)
 *   2. req.tenantId (set by tenantMiddleware for authenticated users)
 *   3. fallback (optional) — e.g. tenantId embedded in the request body
 *
 * Throws BadRequestException if none of the above produce a value.
 */
export function resolveTenantId(req: Request, fallback?: string): string {
  const headerValue = req.headers[TENANT_HEADER];

  const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }

  if (req.tenantId && req.tenantId.trim().length > 0) {
    return req.tenantId;
  }

  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  throw new BadRequestException(
    'Missing tenant context. Pass the X-Tenant-Id header (preferred) or include tenantId in the body.'
  );
}
