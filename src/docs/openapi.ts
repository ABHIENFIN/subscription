import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

// Side-effect import: patches zod with .openapi() BEFORE the DTOs are loaded.
// Must be the first import in this file.
import './extend';

// Import all annotated schemas (they self-register via .openapi() calls)
import {
  CreatePlanSchema,
  UpdatePlanSchema,
  PlanResponseSchema,
  PlanListResponseSchema,
  CreatePlanPriceSchema,
  UpdatePlanPriceSchema,
  PlanPriceResponseSchema,
  PlanPriceListResponseSchema,
  RecordUsageSchema,
} from '../modules/plans/plan.dto';
import {
  CreateSubscriptionSchema,
  CancelSubscriptionSchema,
} from '../modules/subscriptions/subscription.dto';
import {
  CreateCustomerSchema,
} from '../modules/customers/customer.dto';
import {
  LoginSchema,
  AuthResponseSchema,
  UserResponseSchema,
} from '../modules/auth/auth.dto';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  TenantResponseSchema,
  TenantListResponseSchema,
} from '../modules/tenants/tenant.dto';
import {
  CreateUserSchema,
  UserListResponseSchema,
} from '../modules/users/user.dto';

import {
  SuccessEnvelope,
  ErrorResponse,
  PaginationQuery,
  bearerAuth,
  tenantIdHeader,
} from './components';

// Helper to keep response blocks terse
const err = (description: string) => ({ description, content: { 'application/json': { schema: ErrorResponse } } });

// X-Tenant-Id is a global header (like the bearer token). It travels with
// every authenticated request, declared once via the security scheme and
// referenced on each path. Webhooks and other public routes opt out.
// Both schemes are combined into a single requirement so callers must
// supply BOTH the JWT and the tenant header.
const tenantSecurity = [{ bearerAuth: [], tenantIdHeader: [] }];

// Create the registry
export const registry = new OpenAPIRegistry();


// Register security schemes ONCE
registry.registerComponent('securitySchemes', 'bearerAuth', bearerAuth);
registry.registerComponent('securitySchemes', 'tenantIdHeader', tenantIdHeader);

// ---------------------------------------------------------------
// PLANS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/plans',
  tags: ['Plans'],
  summary: 'Create a billing plan',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePlanSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Plan created (DRAFT status, not yet synced to payment gateway)',
      content: {
        'application/json': {
          schema: SuccessEnvelope(PlanResponseSchema),
        },
      },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/plans',
  tags: ['Plans'],
  summary: 'List plans in the tenant',
  description: 'Any authenticated role.',
  security: tenantSecurity,
  request: { query: PaginationQuery },
  responses: {
    200: {
      description: 'Plans list',
      content: { 'application/json': { schema: SuccessEnvelope(PlanListResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/plans/{id}',
  tags: ['Plans'],
  summary: 'Get a plan by ID',
  description: 'Any authenticated role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Plan details',
      content: { 'application/json': { schema: SuccessEnvelope(PlanResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/plans/{id}',
  tags: ['Plans'],
  summary: 'Update a plan',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePlanSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Plan updated',
      content: { 'application/json': { schema: SuccessEnvelope(PlanResponseSchema) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/publish',
  tags: ['Plans'],
  summary: 'Publish a DRAFT plan to the payment gateway',
  description:
    'Creates the Stripe Product for this plan tier. Approach A: one Product per tier, many Prices under it. ' +
    'After publish, add prices via POST /plans/{id}/prices and publish each. ' +
    'Idempotent: re-publishing an ACTIVE plan is a no-op. ' +
    'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Plan published (Stripe Product created, productId populated)',
      content: { 'application/json': { schema: SuccessEnvelope(PlanResponseSchema) } },
    },
    400: err('Cannot publish archived plan'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
    502: err('Payment gateway error'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/archive',
  tags: ['Plans'],
  summary: 'Archive a plan',
  description:
    'Sets status=ARCHIVED and isActive=false. Existing subscriptions are unaffected. ' +
    'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Plan archived',
      content: { 'application/json': { schema: SuccessEnvelope(PlanResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/duplicate',
  tags: ['Plans'],
  summary: 'Duplicate a plan as a new DRAFT',
  description:
    'Clones an existing plan into a new DRAFT (no gateway sync). ' +
    'Name is suffixed with " (copy)". gatewayPlanId/gatewaySyncedAt/status are reset. ' +
    'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    201: {
      description: 'Plan duplicated',
      content: { 'application/json': { schema: SuccessEnvelope(PlanResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/plans/{id}',
  tags: ['Plans'],
  summary: 'Delete a plan',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: 'Plan deleted' },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

// ---------------------------------------------------------------
// PLAN PRICES (Approach A — one product, many prices)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/plans/{id}/prices',
  tags: ['PlanPrices'],
  summary: 'List prices attached to a plan',
  description: 'Returns all PlanPrice rows (one per cadence / one-time fee / metered bucket).',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Prices list',
      content: { 'application/json': { schema: SuccessEnvelope(PlanPriceListResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/prices',
  tags: ['PlanPrices'],
  summary: 'Add a price to a plan (DRAFT)',
  description:
    'Adds a Stripe price to the plan\'s product. Use ONE_TIME for setup fees, ' +
    'RECURRING+LICENSED for flat subscriptions, RECURRING+METERED for usage-based. ' +
    'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: CreatePlanPriceSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'PlanPrice created (DRAFT, not yet on Stripe)',
      content: { 'application/json': { schema: SuccessEnvelope(PlanPriceResponseSchema) } },
    },
    400: err('Validation error (e.g. RECURRING missing interval)'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/plans/{id}/prices/{priceId}',
  tags: ['PlanPrices'],
  summary: 'Update a PlanPrice (pre-publish only)',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string(), priceId: z.string() }),
    body: {
      content: {
        'application/json': { schema: UpdatePlanPriceSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'PlanPrice updated',
      content: { 'application/json': { schema: SuccessEnvelope(PlanPriceResponseSchema) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('PlanPrice not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/prices/{priceId}/publish',
  tags: ['PlanPrices'],
  summary: 'Publish a PlanPrice to Stripe',
  description:
    'Creates the Stripe price_... under the plan\'s product. Plan must be published first. ' +
    'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string(), priceId: z.string() }),
  },
  responses: {
    200: {
      description: 'PlanPrice published (gatewayPriceId populated, status=ACTIVE)',
      content: { 'application/json': { schema: SuccessEnvelope(PlanPriceResponseSchema) } },
    },
    400: err('Plan not published, or RECURRING missing interval'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan or PlanPrice not found'),
    502: err('Payment gateway error'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/plans/{id}/prices/{priceId}/archive',
  tags: ['PlanPrices'],
  summary: 'Archive a PlanPrice',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string(), priceId: z.string() }),
  },
  responses: {
    200: {
      description: 'PlanPrice archived',
      content: { 'application/json': { schema: SuccessEnvelope(PlanPriceResponseSchema) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('PlanPrice not found'),
  },
});

// ---------------------------------------------------------------
// SUBSCRIPTIONS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/subscriptions',
  tags: ['Subscriptions'],
  summary: 'Create a subscription',
  description: 'Requires tenant_owner, tenant_admin, or billing_manager role.',
  security: tenantSecurity,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSubscriptionSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Subscription created',
      content: {
        'application/json': {
          schema: SuccessEnvelope(z.any()),
        },
      },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Plan not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/subscriptions',
  tags: ['Subscriptions'],
  summary: 'List subscriptions',
  description: 'Any authenticated role.',
  security: tenantSecurity,
  request: { query: PaginationQuery },
  responses: {
    200: {
      description: 'Subscriptions list',
      content: { 'application/json': { schema: SuccessEnvelope(z.array(z.any())) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/subscriptions/{id}',
  tags: ['Subscriptions'],
  summary: 'Get a subscription by ID',
  description: 'Any authenticated role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Subscription details',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Subscription not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/subscriptions/{id}/cancel',
  tags: ['Subscriptions'],
  summary: 'Cancel a subscription',
  description: 'Requires tenant_owner, tenant_admin, or billing_manager role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: CancelSubscriptionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Subscription cancelled',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Subscription not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/subscriptions/{id}/pause',
  tags: ['Subscriptions'],
  summary: 'Pause a subscription',
  description: 'Requires tenant_owner, tenant_admin, or billing_manager role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Subscription paused',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Subscription not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/subscriptions/{id}/resume',
  tags: ['Subscriptions'],
  summary: 'Resume a paused subscription',
  description: 'Requires tenant_owner, tenant_admin, or billing_manager role.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Subscription resumed',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Subscription not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/subscriptions/{id}/usage',
  tags: ['Subscriptions'],
  summary: 'Report usage against a metered PlanPrice',
  description:
    'For subscriptions containing a RECURRING+METERED price, report quantity consumed. ' +
    'Stripe aggregates usage and bills at period end. Requires tenant_owner, tenant_admin, or billing_manager.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': { schema: RecordUsageSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Usage recorded',
      content: { 'application/json': { schema: SuccessEnvelope(z.object({ ok: z.boolean() })) } },
    },
    400: err('PlanPrice is not RECURRING+METERED, or validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Subscription or PlanPrice not found, or no matching Stripe subscription item'),
  },
});

// ---------------------------------------------------------------
// CUSTOMERS (thin proxy to the payment gateway — no local state)
// Called by the auth/identity service when it needs to create a Stripe
// customer for one of its users. The auth service holds the returned
// cus_... and passes it back to POST /subscriptions as `paymentMethodId`.
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/customers',
  tags: ['Customers'],
  summary: 'Create a Stripe customer',
  description:
    'Thin proxy to the payment gateway. Returns the gateway customer (id, email, name). ' +
    'No local state is stored — the auth/identity service holds the cus_... and supplies it ' +
    'to POST /subscriptions as `paymentMethodId`.',
  security: tenantSecurity,
  request: {
    headers: z.object({ 'x-tenant-id': z.string().uuid() }),
    body: { content: { 'application/json': { schema: CreateCustomerSchema } } },
  },
  responses: {
    201: { description: 'Customer created in the gateway', content: { 'application/json': { schema: SuccessEnvelope(z.object({
      id: z.string().describe('Stripe cus_...'),
      email: z.string().email(),
      name: z.string().optional(),
    })) } } },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Missing required role'),
  },
});

// ---------------------------------------------------------------
// AUTH (stub — real auth lives in the external identity service)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Stub login (dummy)',
  description:
    'Stub. The real auth/identity service owns login. For local dev, any non-empty email/password ' +
    'returns a hardcoded admin user with platform + tenant roles and a signed JWT pair.',
  request: {
    body: { content: { 'application/json': { schema: LoginSchema } } },
  },
  responses: {
    200: { description: 'Authenticated', content: { 'application/json': { schema: SuccessEnvelope(AuthResponseSchema) } } },
    400: err('Validation error'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Stub refresh',
  description: 'Stub. Verifies the refresh token and issues a new pair.',
  request: {
    body: { content: { 'application/json': { schema: z.object({ refreshToken: z.string() }) } } },
  },
  responses: {
    200: { description: 'Token pair refreshed', content: { 'application/json': { schema: SuccessEnvelope(AuthResponseSchema) } } },
    401: err('Invalid refresh token'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Stub current user',
  description: 'Stub. Returns the user encoded in the bearer token.',
  security: tenantSecurity,
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: SuccessEnvelope(UserResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Missing tenant context'),
  },
});

// ---------------------------------------------------------------
// TENANTS (stub — real ownership is in the identity service)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/tenants',
  tags: ['Tenants'],
  summary: 'List tenants',
  description: 'Any authenticated role. Platform role required for cross-tenant visibility.',
  security: tenantSecurity,
  request: { query: PaginationQuery },
  responses: {
    200: { description: 'Tenants list', content: { 'application/json': { schema: SuccessEnvelope(TenantListResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/tenants',
  tags: ['Tenants'],
  summary: 'Create a tenant',
  description: 'Stub. Requires super_admin or platform_admin.',
  security: tenantSecurity,
  request: {
    body: { content: { 'application/json': { schema: CreateTenantSchema } } },
  },
  responses: {
    201: { description: 'Tenant created', content: { 'application/json': { schema: SuccessEnvelope(TenantResponseSchema) } } },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    409: err('Slug already in use'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/tenants/{id}',
  tags: ['Tenants'],
  summary: 'Get a tenant by ID',
  security: tenantSecurity,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Tenant details', content: { 'application/json': { schema: SuccessEnvelope(TenantResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Tenant not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/tenants/{id}',
  tags: ['Tenants'],
  summary: 'Update a tenant',
  description: 'Stub. Requires super_admin or platform_admin.',
  security: tenantSecurity,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateTenantSchema } } },
  },
  responses: {
    200: { description: 'Tenant updated', content: { 'application/json': { schema: SuccessEnvelope(TenantResponseSchema) } } },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Tenant not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/tenants/{id}',
  tags: ['Tenants'],
  summary: 'Delete a tenant',
  description: 'Stub. Requires super_admin or platform_admin.',
  security: tenantSecurity,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Tenant deleted' },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Tenant not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/tenants/{id}/deactivate',
  tags: ['Tenants'],
  summary: 'Deactivate a tenant',
  description: 'Stub. Sets isActive=false. Requires super_admin or platform_admin.',
  security: tenantSecurity,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Tenant deactivated', content: { 'application/json': { schema: SuccessEnvelope(TenantResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('Tenant not found'),
  },
});

// ---------------------------------------------------------------
// USERS (stub — real ownership is in the identity service)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'List users',
  description:
    'Stub. Tenant-scoped callers are pinned to their own tenant. Platform callers may pass ?tenantId= to filter.',
  security: tenantSecurity,
  request: { query: PaginationQuery.extend({ tenantId: z.string().uuid().optional() }) },
  responses: {
    200: { description: 'Users list', content: { 'application/json': { schema: SuccessEnvelope(UserListResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  summary: 'Create a user',
  description:
    'Stub. Tenant-scoped callers are pinned to their own tenant. Platform callers must supply tenantId in the body.',
  security: tenantSecurity,
  request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
  responses: {
    201: { description: 'User created', content: { 'application/json': { schema: SuccessEnvelope(UserResponseSchema) } } },
    400: err('Validation error / missing tenantId'),
    401: err('Unauthenticated'),
    403: err('Forbidden / cross-tenant create'),
    409: err('Email already in use'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get a user by ID',
  description: 'Stub. Tenant-scoped callers can only fetch users in their own tenant.',
  security: tenantSecurity,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'User details', content: { 'application/json': { schema: SuccessEnvelope(UserResponseSchema) } } },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User not found'),
  },
});

// ---------------------------------------------------------------
// WEBHOOKS (public — raw body, HMAC verified per provider)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/webhooks',
  tags: ['Webhooks'],
  summary: 'Receive a provider webhook',
  description:
    'Stripe, PayPal, Razorpay, or Braintree webhook. Body is verified per-provider via HMAC signature headers. Not JSON-validated server-side.',
  request: {
    query: z.object({
      provider: z.enum(['stripe', 'paypal', 'razorpay', 'braintree']),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.any().openapi('WebhookRawBody'),
        },
      },
    },
  },
  responses: {
    200: { description: 'Webhook accepted' },
    400: { description: 'Invalid signature' },
  },
});

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Subscription Service API',
      version: '1.0.0',
      description:
        'Multi-tenant subscription microservice. All authenticated endpoints require a bearer JWT.',
    },
    servers: [{ url: 'http://localhost:3000/api/v1' }],
  });
}
