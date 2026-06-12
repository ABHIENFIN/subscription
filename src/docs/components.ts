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
// Security scheme
// ---------------------------------------------------------------
export const bearerAuth = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT issued by /auth/login or /auth/refresh',
} as const;