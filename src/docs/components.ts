import { z } from 'zod';

// ---------------------------------------------------------------
// Success envelope wrapper: { data: T }
// ---------------------------------------------------------------
export function SuccessEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({ data: dataSchema }).openapi('SuccessEnvelope');
}

// ---------------------------------------------------------------
// Error envelope: { error: { code, message, details? } }
// ---------------------------------------------------------------
export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum([
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'VALIDATION_ERROR',
      'UNIQUE_VIOLATION',
      'INTERNAL_ERROR',
      'ERROR',
    ]),
    message: z.string(),
    details: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
        })
      )
      .optional(),
  }),
}).openapi('ErrorResponse');

// ---------------------------------------------------------------
// Pagination query: ?skip=0&take=20
// ---------------------------------------------------------------
export const PaginationQuery = z.object({
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20),
}).openapi('PaginationQuery');

// ---------------------------------------------------------------
// Security schemes
// ---------------------------------------------------------------
export const bearerAuth = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT issued by /auth/login or /auth/refresh',
} as const;

// Global tenant header, sent on every authenticated request alongside the
// bearer token. Declared as a security scheme so Swagger UI / Redoc expose
// it through the "Authorize" dialog (same UX as the JWT).
export const tenantIdHeader = {
  type: 'apiKey',
  in: 'header',
  name: 'X-Tenant-Id',
  description:
    'Tenant context for the request. Resolved in this order: ' +
    '(1) this header, (2) req.tenantId set by tenantMiddleware, ' +
    '(3) tenantId in the request body. UUID.',
} as const;