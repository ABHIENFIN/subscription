import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  metadata: z.record(z.string()).optional(),
}).openapi('CreateCustomerRequest', {
  description:
    'Create a Stripe customer on behalf of the auth/identity service. ' +
    'This service does not store the customer locally — the returned Stripe ' +
    'cus_... is held by the caller and passed back to POST /subscriptions ' +
    'as `paymentMethodId`.',
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
