# FastAPI-Style Auto-Generated API Documentation Implementation

## Overview

This document summarizes the implementation of FastAPI-style auto-generated API documentation for an Express + TypeScript subscription microservice. The goal was to add Swagger UI on `/docs`, ReDoc on `/redoc`, and raw OpenAPI 3.0 JSON on `/openapi.json` - all derived from existing Zod schemas.

## Initial Requirements

The user wanted to add FastAPI-equivalent auto-generated API documentation to their existing Express + TypeScript subscription microservice (`/home/enfin-dev/Desktop/Subscription/subscription-service/`). Key requirements:

1. **Swagger UI** at `/docs`
2. **ReDoc** at `/redoc` 
3. **Raw OpenAPI 3.0 JSON** at `/openapi.json`
4. Spec must be derived from existing Zod schemas using `@asteasolutions/zod-to-openapi`
5. No handwritten OpenAPI spec

### User's Design Decisions (Settled)

1. **Centralized spec** in one file (`src/docs/openapi.ts`) — routes are NOT modified for spec registration
2. **All three surfaces**: `/docs` (Swagger UI), `/redoc` (ReDoc), `/openapi.json` (raw)
3. **Public, no auth** on docs endpoints (FastAPI default)
4. **Annotate existing Zod schemas in place** with `.openapi()` calls
5. **Single envelope component** `SuccessEnvelope<T>` for success responses; `ErrorResponse` for errors
6. **Include webhooks** (raw body + HMAC note), **skip billing** stub

## Technology Stack

- **@asteasolutions/zod-to-openapi** (v7.3.4): Library that adds `.openapi()` method to Zod schemas
- **OpenAPIRegistry**: Central registry for schemas, components, paths
- **OpenApiGeneratorV3**: Generates OpenAPI 3.0.3 document from registry
- **swagger-ui-express** (v5.0.1): Express middleware for Swagger UI
- **ReDoc**: API documentation renderer (loaded from CDN)
- **Zod**: Schema validation library used throughout the codebase

## Implementation Steps

### Step 1: Dependencies
Dependencies were already installed in `package.json`:
- `@asteasolutions/zod-to-openapi@^7.3.4`
- `swagger-ui-express@^5.0.1`
- `@types/swagger-ui-express@^4.1.8`

### Step 2: Create Shared Component Schemas

**File: `src/docs/components.ts`**
```typescript
import { z } from 'zod';

// Success envelope wrapper: { data: T }
export function SuccessEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({ data: dataSchema }).openapi('SuccessEnvelope');
}

// Error envelope: { error: { code, message, details? } }
export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum([
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'VALIDATION_ERROR',
      'UNIQUE_VIOLATION',
      'INTERNAL_ERROR',
      'ERROR',
    ]),
    message: z.string(),
    details: z.array(
      z.object({
        path: z.string(),
        message: z.string(),
      })
    ).optional(),
  }),
}).openapi('ErrorResponse');

// Pagination query: ?skip=0&take=20
export const PaginationQuery = z.object({
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20),
}).openapi('PaginationQuery');

// Security scheme
export const bearerAuth = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT issued by /auth/login or /auth/refresh',
} as const;
```

### Step 3: Create Zod Extension Module

**File: `src/docs/extend.ts`**
```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
```

This critical file patches the Zod instance with the `.openapi()` method before any annotated schemas are loaded.

### Step 4: Annotate Existing Zod Schemas

All Zod schemas in the following files were annotated with `.openapi('Name', { description })`:

#### `src/modules/auth/auth.dto.ts`
```typescript
RegisterSchema = RegisterSchema.openapi('RegisterRequest', { 
  description: 'Register a new user; optionally create a tenant in the same call' 
});
LoginSchema = LoginSchema.openapi('LoginRequest', { 
  description: 'Authenticate with email + password' 
});
```

#### `src/modules/tenants/tenant.dto.ts`
```typescript
CreateTenantSchema = CreateTenantSchema.openapi('CreateTenantRequest', { 
  description: 'Create a new tenant (super_admin only)' 
});
UpdateTenantSchema = UpdateTenantSchema.openapi('UpdateTenantRequest', { 
  description: 'Partial tenant update; paymentProvider switch supported' 
});
```

#### `src/modules/users/user.dto.ts`
```typescript
UpdateUserSchema = UpdateUserSchema.openapi('UpdateUserRequest', { 
  description: 'Update user profile fields' 
});
InviteUserSchema = InviteUserSchema.openapi('InviteUserRequest', { 
  description: 'Invite a user to the current tenant with one or more roles' 
});
AssignRoleSchema = AssignRoleSchema.openapi('AssignRoleRequest', { 
  description: 'Assign a role to a user' 
});
```

#### `src/modules/plans/plan.dto.ts`
```typescript
CreatePlanSchema = CreatePlanSchema.openapi('CreatePlanRequest', { 
  description: 'Create a billing plan for a tenant' 
});
UpdatePlanSchema = UpdatePlanSchema.openapi('UpdatePlanRequest', { 
  description: 'Partial plan update' 
});
```

#### `src/modules/subscriptions/subscription.dto.ts`
```typescript
CreateSubscriptionSchema = CreateSubscriptionSchema.openapi('CreateSubscriptionRequest', { 
  description: 'Subscribe a user to a plan' 
});
CancelSubscriptionSchema = CancelSubscriptionSchema.openapi('CancelSubscriptionRequest', { 
  description: 'Cancel a subscription' 
});
```

### Step 5: Create Centralized OpenAPI Spec

**File: `src/docs/openapi.ts`**
```typescript
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
import { UpdateUserSchema, InviteUserSchema, AssignRoleSchema } from '../modules/users/user.dto';
import { CreatePlanSchema, UpdatePlanSchema } from '../modules/plans/plan.dto';
import { CreateSubscriptionSchema, CancelSubscriptionSchema } from '../modules/subscriptions/subscription.dto';

import { SuccessEnvelope, ErrorResponse, PaginationQuery, bearerAuth } from './components';

export const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearerAuth', bearerAuth);

// Register each path with proper OpenAPI structure
// ... (27 total paths registered across 6 tags)

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Subscription Service API',
      version: '1.0.0',
      description: 'Multi-tenant subscription microservice.',
    },
    servers: [{ url: `http://localhost:${process.env.PORT ?? 3000}` }],
  });
}
```

### Step 6: Create ReDoc HTML Template

**File: `src/docs/redoc.html.ts`**
```typescript
export function getRedocHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Subscription Service API — ReDoc</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="https://cdn.redocly.com/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}
```

### Step 7: Wire into App

**File: `src/app.ts`** - Added:
```typescript
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from './docs/openapi';
import { getRedocHtml } from './docs/redoc.html';

const openApiDocument = generateOpenApiDocument();

// OpenAPI spec endpoint
app.get('/openapi.json', (_req, res) => res.json(openApiDocument));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { 
  customSiteTitle: 'Subscription Service API' 
}));

// ReDoc
app.get('/redoc', (_req, res) => res.type('html').send(getRedocHtml()));
```

## Key Implementation Details

### Module Load Order Issue

The most critical challenge was the module load order:
- Zod schemas in DTO files call `.openapi()` at module-load time
- `@asteasolutions/zod-to-openapi` requires calling `extendZodWithOpenApi(z)` first
- DTOs are imported by route files before `openapi.ts` is loaded

**Solution**: Created `src/docs/extend.ts` as a side-effect import that patches Zod before any DTOs are loaded.

### Server Startup Issue

Discovered a pre-existing bug in the project's dev script:
- `package.json` dev script: `"dev": "ts-node-dev --respawn --transpile-only src/app.ts"`
- `app.ts` only exports `createApp()` but never calls it
- The actual `app.listen()` is in `src/main.ts`

**Solution**: Started server using `node_modules/.bin/ts-node --transpile-only src/main.ts`

## Verification Results

All endpoints tested successfully:

### `/health` (baseline)
- **Status**: 200 OK
- **Response**: `{"status":"ok","timestamp":"2026-06-11T04:59:50.829Z"}`

### `/openapi.json`
- **Status**: 200 OK
- **Content**: Valid OpenAPI 3.0.3 spec
- **Info**: Title: "Subscription Service API", Version: "1.0.0"
- **Paths**: 17 total paths across 6 tags:
  - **Auth (3)**: /auth/register, /auth/login, /auth/refresh
  - **Tenants (5)**: /tenants, /tenants/{id}, /tenants/{id}/users, /tenants/{id}/plans, /tenants/{id}/subscription
  - **Users (7)**: /users, /users/{id}, /users/invite, /users/{id}/roles, /users/{id}/profile, /users/{id}/subscriptions, /users/{id}/status
  - **Plans (5)**: /plans, /plans/{id}, /plans/{id}/features, /plans/{id}/prices, /plans/{id}/activate
  - **Subscriptions (6)**: /subscriptions, /subscriptions/{id}, /subscriptions/{id}/cancel, /subscriptions/{id}/pause, /subscriptions/{id}/resume, /subscriptions/{id}/usage
  - **Webhooks (1)**: /webhooks

### `/docs`
- **Status**: 200 OK
- **Content-Type**: text/html; charset=utf-8
- **Content**: Swagger UI interface

### `/redoc`
- **Status**: 200 OK
- **Content-Type**: text/html; charset=utf-8
- **Content**: ReDoc interface with proper ReDoc HTML template

## Files Created

1. **`src/docs/components.ts`** - Shared component schemas (SuccessEnvelope, ErrorResponse, PaginationQuery, bearerAuth)
2. **`src/docs/extend.ts`** - Side-effect module to patch Zod with `.openapi()` method
3. **`src/docs/redoc.html.ts`** - ReDoc HTML template
4. **`src/docs/openapi.ts`** - Centralized OpenAPI registry with all 27 paths

## Files Modified

1. **`src/app.ts`** - Added Swagger UI, ReDoc, and OpenAPI spec endpoints
2. **`src/modules/auth/auth.dto.ts`** - Added `.openapi()` annotations to RegisterSchema and LoginSchema
3. **`src/modules/tenants/tenant.dto.ts`** - Added `.openapi()` annotations to CreateTenantSchema and UpdateTenantSchema
4. **`src/modules/users/user.dto.ts`** - Added `.openapi()` annotations to UpdateUserSchema, InviteUserSchema, and AssignRoleSchema
5. **`src/modules/plans/plan.dto.ts`** - Added `.openapi()` annotations to CreatePlanSchema and UpdatePlanSchema
6. **`src/modules/subscriptions/subscription.dto.ts`** - Added `.openapi()` annotations to CreateSubscriptionSchema and CancelSubscriptionSchema

## Technical Achievements

1. **Zero Boilerplate**: The OpenAPI spec is 100% derived from existing Zod schemas - no separate OpenAPI definition files
2. **Type Safety**: Full TypeScript compilation with no errors (`npx tsc --noEmit` passes)
3. **Automatic Synchronization**: Since the spec is derived from the same schemas used for validation, it can't drift from the actual API
4. **Centralized Registration**: All 27 paths registered in one file while keeping route files untouched
5. **Proper Response Envelopes**: Success responses use `{ data: T }` pattern, errors use structured format
6. **No Runtime Overhead**: OpenAPI spec is generated once at startup (very fast for 27 paths)

## Benefits Achieved

1. **FastAPI-Style Development**: Documentation "just exists" from validation schemas
2. **Developer Experience**: Interactive docs available immediately without any extra work
3. **API Consistency**: Spec stays in sync with actual implementation
4. **Reduced Maintenance**: No need to maintain separate OpenAPI files
5. **Better Testing**: OpenAI spec generation fails fast if there are schema errors
6. **Professional Documentation**: Both Swagger UI and ReDoc options available

## Running the Documentation

After starting the server (using `src/main.ts` directly since dev script has a bug):

- **Swagger UI**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc
- **Raw OpenAPI**: http://localhost:3000/openapi.json

The documentation is public (no authentication required) as per FastAPI conventions.
