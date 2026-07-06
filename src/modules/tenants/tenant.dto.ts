import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, digits, and hyphens',
  }),
}).openapi('CreateTenantRequest', {
  description: 'Stub tenant creation. In production this is owned by the external identity service.',
});

export const UpdateTenantSchema = CreateTenantSchema.partial().extend({
  isActive: z.boolean().optional(),
}).openapi('UpdateTenantRequest');

export const TenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('TenantResponse');

export const TenantListResponseSchema = z.array(TenantResponseSchema).openapi('TenantListResponse');

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
export type TenantResponse = z.infer<typeof TenantResponseSchema>;
