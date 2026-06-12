import { z } from 'zod';

export const CreatePlanSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  interval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
  intervalCount: z.number().int().positive().default(1),
  trialDays: z.number().int().nonnegative().default(0),
}).openapi('CreatePlanRequest', { description: 'Create a billing plan for a tenant' });

export const UpdatePlanSchema = CreatePlanSchema.partial().extend({
  isActive: z.boolean().optional(),
}).openapi('UpdatePlanRequest', { description: 'Partial plan update; isActive flag supported' });

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;