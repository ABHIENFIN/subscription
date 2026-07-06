import { z } from 'zod';

export const CreatePlanSchema = z.object({
  tenantId: z.string().uuid().optional()
    .describe('Optional in body. Prefer X-Tenant-Id header — header takes precedence.'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  features: z.record(z.unknown()).optional()
    .describe('Per-tier entitlement map (e.g. {"api_calls_per_month": 50000})'),
}).openapi('CreatePlanRequest', { description: 'Create a plan (the marketing tier / product concept). Always starts in DRAFT. Add one or more prices via POST /plans/:id/prices.' });

export const UpdatePlanSchema = CreatePlanSchema.partial().extend({
  isActive: z.boolean().optional(),
}).openapi('UpdatePlanRequest', { description: 'Partial plan update; isActive flag supported' });

export const PlanResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  productId: z.string().nullable().optional()
    .describe('Stripe prod_... — set after publish.'),
  features: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('PlanResponse', { description: 'Plan resource. Holds the Stripe Product; cadences are separate PlanPrice rows.' });

export const PlanListResponseSchema = z.array(PlanResponseSchema).openapi('PlanListResponse');

// --------------------------------------------
// PlanPrice — one Stripe price_... per cadence
// --------------------------------------------
export const CreatePlanPriceSchema = z.object({
  type: z.enum(['RECURRING', 'ONE_TIME']).default('RECURRING'),
  amount: z.number().int().nonnegative()
    .describe('Smallest currency unit (cents). 2900 = $29.00.'),
  currency: z.string().length(3).default('USD'),
  interval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).optional()
    .describe('Required when type=RECURRING. Ignored when type=ONE_TIME.'),
  intervalCount: z.number().int().positive().default(1)
    .describe('e.g. 3 = every 3 months when interval=MONTH'),
  usageType: z.enum(['LICENSED', 'METERED']).default('LICENSED')
    .describe('LICENSED = flat per period. METERED = billed by usage reported via /subscriptions/:id/usage.'),
  trialDays: z.number().int().nonnegative().default(0),
  nickname: z.string().optional()
    .describe('Display label, e.g. "monthly", "yearly", "setup". Not unique.'),
}).openapi('CreatePlanPriceRequest', { description: 'Add a price to a plan. ONE_TIME for setup fees; RECURRING with METERED for usage-based billing.' });

export const UpdatePlanPriceSchema = CreatePlanPriceSchema.partial().extend({
  isActive: z.boolean().optional(),
}).openapi('UpdatePlanPriceRequest', { description: 'Partial price update; isActive flag supported' });

export const PlanPriceResponseSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  gatewayPriceId: z.string().nullable().optional()
    .describe('Stripe price_... — set after publish.'),
  amount: z.number().int(),
  currency: z.string(),
  interval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).nullable().optional(),
  intervalCount: z.number().int(),
  type: z.enum(['RECURRING', 'ONE_TIME']),
  usageType: z.enum(['LICENSED', 'METERED']),
  trialDays: z.number().int(),
  nickname: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  gatewaySyncedAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean(),
  // USD snapshot — captured at publish. Immutable. Use for revenue reporting / aggregation.
  // Display always reads `amount` + `currency` (the user's original currency).
  amountUsdCents: z.number().int().nullable().optional()
    .describe('USD amount in cents (smallest unit). Snapshot at publish. NULL only for legacy rows.'),
  fxRate: z.string().nullable().optional()
    .describe('FX rate as foreign-per-1-USD (e.g. "83.50000000" = 1 USD = 83.50 INR). Snapshot at publish. "1.00000000" for USD.'),
  fxAsOf: z.string().datetime().nullable().optional()
    .describe('Timestamp when the FX rate was captured. Immutable.'),
  fxSource: z.string().nullable().optional()
    .describe('Origin of the FX rate: "frankfurter" | "manual" | "identity". Immutable.'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('PlanPriceResponse', { description: 'Plan price (one Stripe price_... under the plan\'s product).' });

export const PlanPriceListResponseSchema = z.array(PlanPriceResponseSchema).openapi('PlanPriceListResponse');

export const RecordUsageSchema = z.object({
  planPriceId: z.string().uuid()
    .describe('The metered price whose usage you\'re reporting.'),
  quantity: z.number().int().nonnegative(),
  timestamp: z.string().datetime().optional(),
  action: z.enum(['increment', 'set']).default('increment'),
}).openapi('RecordUsageRequest', { description: 'Report usage against a metered subscription item.' });

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type CreatePlanPriceDto = z.infer<typeof CreatePlanPriceSchema>;
export type UpdatePlanPriceDto = z.infer<typeof UpdatePlanPriceSchema>;
export type PlanPriceResponse = z.infer<typeof PlanPriceResponseSchema>;
export type RecordUsageDto = z.infer<typeof RecordUsageSchema>;
