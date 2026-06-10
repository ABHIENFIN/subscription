import { z } from 'zod';

export const CreateSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
});

export const CancelSubscriptionSchema = z.object({
  immediately: z.boolean().default(false),
});

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;