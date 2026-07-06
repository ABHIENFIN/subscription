import { z } from 'zod';

export const CreateSubscriptionSchema = z.object({
  tenantId: z.string().uuid().optional()
    .describe('Optional in body. Prefer X-Tenant-Id header — header takes precedence.'),
  planId: z.string().uuid(),
  planPriceId: z.string().uuid()
    .describe('The recurring PlanPrice to subscribe to (the primary item).'),
  addons: z.array(z.string().uuid()).default([])
    .describe('Additional PlanPrice IDs to attach (e.g. one-time setup fees). Each becomes a separate line item on the Stripe subscription.'),
  userId: z.string().uuid()
    .describe('External user ID (issued by the auth service).'),
  paymentMethodId: z.string().optional()
    .describe('Stripe customer ID (cus_...) to charge. Same field reused as customer ID per gateway contract.'),
}).openapi('CreateSubscriptionRequest', { description: 'Subscribe a user to a plan + primary price, with optional add-on prices (e.g. one-time setup).' });

export const CancelSubscriptionSchema = z.object({
  tenantId: z.string().uuid().optional()
    .describe('Optional in body. Prefer X-Tenant-Id header — header takes precedence.'),
  immediately: z.boolean().default(false),
}).openapi('CancelSubscriptionRequest', { description: 'Cancel a subscription; if immediately=true, no grace period. Tenant resolved from X-Tenant-Id header.' });

export const RecordUsageSchema = z.object({
  tenantId: z.string().uuid().optional(),
  planPriceId: z.string().uuid(),
  quantity: z.number().int().nonnegative(),
  timestamp: z.string().datetime().optional(),
  action: z.enum(['increment', 'set']).default('increment'),
}).openapi('RecordUsageRequest', { description: 'Report usage against a metered subscription item.' });

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;
export type RecordUsageDto = z.infer<typeof RecordUsageSchema>;