import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

// Side-effect import: patches zod with .openapi() BEFORE the DTOs are loaded.
// Must be the first import in this file.
import './extend';

// Import all annotated schemas (they self-register via .openapi() calls)
import { RegisterSchema, LoginSchema } from '../modules/auth/auth.dto';
import { CreateTenantSchema, UpdateTenantSchema } from '../modules/tenants/tenant.dto';
import {
  UpdateUserSchema,
  InviteUserSchema,
  AssignRoleSchema,
} from '../modules/users/user.dto';
import { CreatePlanSchema, UpdatePlanSchema } from '../modules/plans/plan.dto';
import {
  CreateSubscriptionSchema,
  CancelSubscriptionSchema,
} from '../modules/subscriptions/subscription.dto';

import {
  SuccessEnvelope,
  ErrorResponse,
  PaginationQuery,
  bearerAuth,
} from './components';

// Helper to keep response blocks terse
const err = (description: string) => ({ description, content: { 'application/json': { schema: ErrorResponse } } });

// Create the registry
export const registry = new OpenAPIRegistry();

// Register the bearer security scheme ONCE
registry.registerComponent('securitySchemes', 'bearerAuth', bearerAuth);

// ---------------------------------------------------------------
// AUTH (public — no security)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  description:
    'Register a new user. Optionally create a tenant and assign the user tenant_owner role.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created. Returns access + refresh tokens.',
      content: {
        'application/json': {
          schema: SuccessEnvelope(
            z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                tenantId: z.string().optional(),
                roles: z.array(z.string()),
              }),
              accessToken: z.string(),
              refreshToken: z.string(),
            })
          ),
        },
      },
    },
    400: err('Validation error'),
    409: err('Email already exists'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Authenticate with email + password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Authenticated. Returns access + refresh tokens.',
      content: {
        'application/json': {
          schema: SuccessEnvelope(
            z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                tenantId: z.string().optional(),
                roles: z.array(z.string()),
              }),
              accessToken: z.string(),
              refreshToken: z.string(),
            })
          ),
        },
      },
    },
    401: err('Invalid credentials'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Exchange refresh token for new access token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'New tokens issued.',
      content: {
        'application/json': {
          schema: SuccessEnvelope(
            z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
            })
          ),
        },
      },
    },
    400: err('Missing refresh token'),
    401: err('Invalid or expired refresh token'),
  },
});

// ---------------------------------------------------------------
// TENANTS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/tenants',
  tags: ['Tenants'],
  summary: 'Create a tenant',
  description: 'Requires super_admin role.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTenantSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Tenant created',
      content: {
        'application/json': {
          schema: SuccessEnvelope(
            z.object({
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              domain: z.string().optional(),
              status: z.string(),
              paymentProvider: z.string().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
            })
          ),
        },
      },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden — super_admin only'),
    409: err('Tenant slug already exists'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/tenants',
  tags: ['Tenants'],
  summary: 'List all tenants',
  description: 'Requires super_admin or platform_admin role.',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuery },
  responses: {
    200: {
      description: 'Tenants list',
      content: { 'application/json': { schema: SuccessEnvelope(z.array(z.any())) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden — platform role required'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/tenants/{id}',
  tags: ['Tenants'],
  summary: 'Get a tenant by ID',
  description: 'Any authenticated role.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Tenant details',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
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
  description: 'Requires super_admin or tenant_owner role.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTenantSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tenant updated',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
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
  description: 'Requires super_admin role.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: 'Tenant deleted' },
    401: err('Unauthenticated'),
    403: err('Forbidden — super_admin only'),
    404: err('Tenant not found'),
  },
});

// ---------------------------------------------------------------
// USERS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/users/invite',
  tags: ['Users'],
  summary: 'Invite a user to the tenant',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: InviteUserSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User invited',
      content: {
        'application/json': {
          schema: SuccessEnvelope(z.any()),
        },
      },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    409: err('User already exists'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'List users in the tenant',
  description: 'All roles except billing_manager.',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuery },
  responses: {
    200: {
      description: 'Users list',
      content: { 'application/json': { schema: SuccessEnvelope(z.array(z.any())) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get a user by ID',
  description: 'All roles except billing_manager.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'User details',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Update a user',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Delete a user',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: 'User deleted' },
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/users/{id}/roles',
  tags: ['Users'],
  summary: 'Assign a role to a user',
  description:
    'Requires super_admin, tenant_owner, or tenant_admin role. Body: { roleName: string }.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: AssignRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role assigned',
      content: {
        'application/json': {
          schema: SuccessEnvelope(z.any()),
        },
      },
    },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User or role not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}/roles',
  tags: ['Users'],
  summary: 'Remove a role from a user',
  description:
    'Requires super_admin, tenant_owner, or tenant_admin role. Body: { roleName: string }.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: AssignRoleSchema,
        },
      },
    },
  },
  responses: {
    204: { description: 'Role removed' },
    400: err('Validation error'),
    401: err('Unauthenticated'),
    403: err('Forbidden'),
    404: err('User or role not found'),
  },
});

// ---------------------------------------------------------------
// PLANS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/plans',
  tags: ['Plans'],
  summary: 'Create a billing plan',
  description: 'Requires super_admin, tenant_owner, or tenant_admin role.',
  security: [{ bearerAuth: [] }],
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
      description: 'Plan created',
      content: {
        'application/json': {
          schema: SuccessEnvelope(z.any()),
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
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuery },
  responses: {
    200: {
      description: 'Plans list',
      content: { 'application/json': { schema: SuccessEnvelope(z.array(z.any())) } },
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
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Plan details',
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
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
  security: [{ bearerAuth: [] }],
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
      content: { 'application/json': { schema: SuccessEnvelope(z.any()) } },
    },
    400: err('Validation error'),
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
  security: [{ bearerAuth: [] }],
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
// SUBSCRIPTIONS (protected)
// ---------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/subscriptions',
  tags: ['Subscriptions'],
  summary: 'Create a subscription',
  description: 'Requires tenant_owner, tenant_admin, or billing_manager role.',
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
    servers: [{ url: 'http://localhost:3000' }],
  });
}
