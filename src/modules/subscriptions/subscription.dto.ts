import { z } from 'zod';

export const CreateSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
}).openapi('CreateSubscriptionRequest', { description: 'Subscribe a user to a plan' });

export const CancelSubscriptionSchema = z.object({
  immediately: z.boolean().default(false),
}).openapi('CancelSubscriptionRequest', { description: 'Cancel a subscription; if immediately=true, no grace period' });

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;