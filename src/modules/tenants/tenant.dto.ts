import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  }),
  domain: z.string().url().optional(),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().url().optional(),
  paymentProvider: z.enum(['stripe', 'paypal', 'razorpay', 'braintree']).optional(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
