# Subscription Microservice — Detailed Documentation

> **Deep-dive companion to `README.md`.** This document explains *how the project works* and *how to test it end-to-end*. If you just want to run it, read `README.md`. If you want to understand or test it, keep reading.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Layout](#2-project-layout)
3. [Runtime Architecture](#3-runtime-architecture)
4. [Data Model](#4-data-model)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Module Reference](#6-module-reference)
7. [Payment Gateway Abstraction](#7-payment-gateway-abstraction)
8. [Error Handling](#8-error-handling)
9. [Local Development Setup](#9-local-development-setup)
10. [Testing Guide](#10-testing-guide)
11. [Troubleshooting](#11-troubleshooting)
12. [Appendix: Environment Variables](#appendix-environment-variables)

---

## 1. Overview

A **payment-agnostic, multi-tenant subscription billing service**. It lets multiple tenants share one deployment while keeping their data, users, and subscriptions fully isolated. Subscriptions flow through a swappable payment gateway — today Stripe is wired up; tomorrow any provider can plug in behind the same interface.

### Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript (strict mode) |
| HTTP | Express 4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | JWT (access + refresh), bcryptjs |
| Validation | Zod |
| Payments | Stripe SDK (others stubbed) |
| Security | Helmet, CORS, express-rate-limit |
| Local infra | Docker Compose (Postgres + Redis + Prisma Studio) |

### High-Level Architecture

```
                  ┌─────────────────┐
   HTTP request   │   Middleware    │   helmet, CORS, rate-limit
   ───────────▶   │   (in order)    │   express.json()
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │     Routes      │   /api/v1/auth, /tenants, /users, ...
                  │  authenticate   │   verify JWT
                  │  tenant         │   resolve tenant context
                  │  requireRoles   │   enforce RBAC
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │   Controller    │   parse + validate (Zod)
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │    Service      │   business logic, tenant scoping
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │   Repository    │   Prisma queries
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │   persistent state
                  └─────────────────┘

  Side channel:
  ┌──────────────┐         ┌──────────────────┐
  │   Stripe     │  HTTPS  │ Payment gateway  │
  │   API        │ ◀────▶  │ factory + impls  │
  └──────────────┘         └──────────────────┘

  Inbound:
  ┌──────────────┐  webhook ┌──────────────────┐
  │   Stripe     │ ───────▶ │  /api/v1/webhooks│
  │   (raw body) │          │  (express.raw)   │
  └──────────────┘          └──────────────────┘
```

---

## 2. Project Layout

```
subscription-service/
├── prisma/
│   └── schema.prisma            # Data model (8 models, 6 enums)
├── scripts/
│   └── seed.ts                  # Idempotent seed: 7 roles + super_admin user
├── docker/
│   ├── docker-compose.yml       # Postgres + Redis + Prisma Studio
│   └── Dockerfile               # Node 20 alpine, dev mode
├── src/
│   ├── main.ts                  # Entry: createApp() + listen
│   ├── app.ts                   # Express app factory (middleware, routes)
│   ├── config/                  # Env-driven config singletons
│   │   ├── app.config.ts
│   │   ├── database.config.ts   # Prisma client singleton
│   │   └── jwt.config.ts
│   ├── common/
│   │   ├── enums/               # All enums (roles, statuses, intervals)
│   │   ├── exceptions/          # AppError + 5 typed subclasses
│   │   └── types/               # Express Request augmentation, JWT payload
│   ├── middleware/              # Cross-cutting Express middleware
│   │   ├── auth.middleware.ts   # verify JWT, set req.user
│   │   ├── rbac.middleware.ts   # requireRoles(...)
│   │   ├── tenant.middleware.ts # resolve req.tenantId
│   │   └── errorHandler.middleware.ts
│   ├── modules/                 # Feature modules (controller/service/repo/dto/routes)
│   │   ├── auth/                # Public: register, login, refresh
│   │   ├── tenants/             # CRUD (platform-scoped)
│   │   ├── users/               # CRUD + invite + role assign (tenant-scoped)
│   │   ├── plans/               # CRUD (tenant-scoped)
│   │   ├── subscriptions/       # Lifecycle: create, cancel, pause, resume
│   │   ├── billing/             # Stub
│   │   └── webhooks/            # Raw-body Stripe webhook receiver
│   └── payments/                # Payment gateway abstraction
│       ├── gateway.interface.ts # IPaymentGateway contract
│       ├── gateway.factory.ts   # getGateway(provider) registry
│       ├── stripe/              # Full Stripe implementation
│       ├── paypal/              # Stub
│       ├── razorpay/            # Stub
│       └── braintree/           # Stub
├── docs/                        # You're reading it
├── .env.example                 # All env vars + Vault path comments
├── package.json
├── tsconfig.json
└── README.md
```

**Module pattern.** Every domain module under `src/modules/<name>/` follows the same four-file shape:

| File | Responsibility |
|---|---|
| `<name>.dto.ts` | Zod schemas + inferred TypeScript types |
| `<name>.repository.ts` | Prisma queries only — no business logic |
| `<name>.service.ts` | Business logic, tenant scoping, gateway calls |
| `<name>.controller.ts` | Express handlers: parse → call service → respond |
| `<name>.routes.ts` | URL → controller wiring + middleware chain |

---

## 3. Runtime Architecture

### Bootstrap (`src/main.ts`)

```ts
import { createApp } from './app';
import { appConfig } from './config/app.config';

const app = await createApp();
app.listen(appConfig.port);
```

`createApp()` is in `src/app.ts`. It builds the Express app in this exact order — **order matters**:

1. **`helmet()`** — security headers
2. **`cors({ origin: appConfig.corsOrigins })`** — CORS allowlist from env
3. **`rateLimit({ windowMs: 15m, max: 100 })`** — only applied under `/api`
4. **`express.json()`** + **`express.urlencoded()`** — body parsers
5. **`GET /health`** — public health probe
6. **Route mounts** under `/api/v1/*` (auth → tenants → users → plans → subscriptions → webhooks)
7. **`errorHandler`** — last in the chain; catches everything below

> **Note:** the rate limiter and `express.json()` apply to everything *except* the webhook endpoint, which uses `express.raw({ type: 'application/json' })` at the route level (defined in `webhook.routes.ts`). Webhooks need the raw body to verify Stripe's HMAC signature.

### Request Lifecycle

For a typical authenticated call (e.g. `POST /api/v1/plans`):

```
client
  │
  ├─[1]→  helmet adds security headers
  ├─[2]→  CORS check
  ├─[3]→  rate limiter (counts toward 100/15min)
  ├─[4]→  express.json parses { name, amount, ... }
  │
  ├─[5]→  /api/v1/plans router
  │       │
  │       ├─[6]→  authenticate middleware
  │       │     • reads Authorization: Bearer <jwt>
  │       │     • verifies with jwtConfig.secret
  │       │     • checks type === 'access'
  │       │     • sets req.user = { id, email, tenantId, roles }
  │       │
  │       ├─[7]→  tenant middleware
  │       │     • for tenant users: req.tenantId = req.user.tenantId
  │       │     • for platform users: reads X-Tenant-ID header
  │       │
  │       └─[8]→  requireRoles('super_admin', 'tenant_owner', 'tenant_admin')
  │             • checks req.user.roles ⊇ allowed
  │             • throws ForbiddenException if not
  │
  ├─[9]→  planController.create
  │       • validates body against CreatePlanSchema (Zod)
  │       • calls planService.create(tenantId, dto)
  │
  ├─[10]→ planService.create
  │       • tenant-scoped Prisma insert
  │       • returns persisted plan
  │
  └─[11]→ 201 Created with JSON body
```

Any thrown `AppError` or `ZodError` short-circuits to the `errorHandler` and returns a uniform JSON error response (see [§8](#8-error-handling)).

---

## 4. Data Model

Source: `prisma/schema.prisma`. Provider: PostgreSQL. URL: `env("DATABASE_URL")`.

### Models

| Model | Purpose | Notable fields |
|---|---|---|
| **Tenant** | A customer organization | `slug` (unique), `domain` (unique, optional), `paymentProvider`, `gatewayConfiguredAt` |
| **User** | A person who logs in | `email` (unique), `passwordHash`, `status`, `tenantId` (nullable for platform users) |
| **Role** | A role definition (global) | `name` (unique), `scope` (PLATFORM / TENANT) |
| **UserRole** | User ↔ Role join | `@@unique([userId, roleId])` |
| **Plan** | A subscription tier | `amount` (Decimal 10,2), `currency`, `interval`, `intervalCount`, `trialDays`, `gatewayPlanId`, `isActive` |
| **Subscription** | An active customer subscription | `status`, `gatewayProvider`, `gatewaySubscriptionId`, `currentPeriodStart/End`, `cancelAtPeriodEnd`, `cancelledAt` |
| **Invoice** | A billing event | `amount`, `currency`, `status`, `gatewayInvoiceId`, `paidAt` |

### Enums

| Enum | Values |
|---|---|
| `TenantStatus` | `ACTIVE`, `SUSPENDED`, `DELETED` |
| `UserStatus` | `ACTIVE`, `INVITED`, `SUSPENDED`, `DELETED` |
| `RoleScope` | `PLATFORM`, `TENANT` |
| `BillingInterval` | `DAY`, `WEEK`, `MONTH`, `YEAR` |
| `SubscriptionStatus` | `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELLED`, `PAUSED`, `EXPIRED` |
| `InvoiceStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `VOID` |

### Key Relations

- `Tenant 1—* User` (a tenant has many users; platform users have `tenantId = null`)
- `Tenant 1—* Plan`
- `Tenant 1—* Subscription`
- `User 1—* Subscription`
- `Plan 1—* Subscription`
- `User *—* Role` (via `UserRole`)
- `Subscription 1—* Invoice` (optional — invoices can exist without a subscription)

### Cascading Behavior

Prisma defaults are in effect: deleting a `Tenant` cascades through its users, plans, and subscriptions. Be careful in non-dev environments.

---

## 5. Authentication & Authorization

### JWT Structure

The service uses **two token types** distinguished by the `type` claim:

| Type | Secret | Default TTL | Purpose |
|---|---|---|---|
| `access` | `JWT_SECRET` | 15m | Sent on every API call as `Authorization: Bearer ...` |
| `refresh` | `JWT_REFRESH_SECRET` | 30d | Used only at `/auth/refresh` to get a new access token |

**Access token payload:**
```json
{
  "sub": "uuid-of-user",
  "email": "user@example.com",
  "tenantId": "uuid-or-null",
  "roles": ["tenant_owner"],
  "type": "access",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Refresh token payload:** identical shape but `type: "refresh"` and signed with a different secret.

### Password Hashing

`bcryptjs` with cost factor `12`. Hashed once at registration and never returned in any response.

### Middleware Chain (in order)

Every protected route runs through this exact sequence:

1. **`authenticate`** (`src/middleware/auth.middleware.ts`)
   - Reads `Authorization: Bearer <token>` header
   - Verifies signature with `jwtConfig.secret`
   - Rejects if `type !== 'access'`
   - On success: sets `req.user = { id, email, tenantId, roles }`
   - Throws `UnauthorizedException` on missing/invalid/expired

2. **`tenantMiddleware`** (`src/middleware/tenant.middleware.ts`)
   - **Platform users** (`super_admin`, `platform_admin`): read tenant from `X-Tenant-ID` header. Header is **required**.
   - **Tenant users**: pinned to `req.user.tenantId`. Header is ignored (and forbidden).
   - On success: sets `req.tenantId`
   - Throws `BadRequestException` (missing header) or `ForbiddenException` (mismatch)

3. **`requireRoles(...roles)`** (`src/middleware/rbac.middleware.ts`)
   - Factory: `requireRoles('tenant_owner', 'tenant_admin')` returns middleware
   - Checks `req.user.roles` is a superset of the allowed list
   - Throws `ForbiddenException` if the user lacks any required role
   - Throws `UnauthorizedException` if `req.user` is missing (defense in depth — should never happen after `authenticate`)

### Two-Tier RBAC

**Platform scope** (cross-tenant operations):
- `super_admin` — full access to everything
- `platform_admin` — read tenants, view billing; can pass `X-Tenant-ID` to act on behalf

**Tenant scope** (operations within a single tenant):
- `tenant_owner` — full tenant control, can delete tenant
- `tenant_admin` — manage users, plans, subscriptions
- `billing_manager` — manage subscriptions, invoices
- `developer` — read-only + API key management
- `viewer` — read-only

### Who Can Call What

| Resource | Create | Read (list) | Update | Delete |
|---|---|---|---|---|
| Tenant | super_admin | super_admin, platform_admin | super_admin, tenant_owner | super_admin |
| User | super_admin, tenant_owner, tenant_admin | any role (scoped) | super_admin, tenant_owner, tenant_admin | super_admin, tenant_owner, tenant_admin |
| Plan | super_admin, tenant_owner, tenant_admin | any role | super_admin, tenant_owner, tenant_admin | super_admin, tenant_owner, tenant_admin |
| Subscription | tenant_owner, tenant_admin, billing_manager | any role | — | — (cancel/pause/resume) |
| Cancel/Pause/Resume | tenant_owner, tenant_admin, billing_manager | — | — | — |

---

## 6. Module Reference

All routes are prefixed with `/api/v1`. Bodies are JSON unless noted.

### 6.1 Auth (`/auth`)

Public — no authentication required.

#### `POST /auth/register`
Register a new user. Optionally creates a tenant in the same call.

**Body:**
```json
{
  "email": "alice@acme.com",
  "password": "supersecret123",
  "firstName": "Alice",
  "lastName": "Doe",
  "tenantId": "uuid-optional",
  "tenantName": "Acme Inc",
  "tenantSlug": "acme"
}
```

- If `tenantName` + `tenantSlug` are provided, a new tenant is created and the user is assigned the `tenant_owner` role in it.
- If `tenantId` is provided, the user is added to that tenant with no role (caller must assign one).
- If neither, a platform-level user is created with no roles.

**Response 201:**
```json
{
  "data": {
    "user": { "id": "...", "email": "...", "firstName": "...", "lastName": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### `POST /auth/login`
**Body:** `{ "email": "...", "password": "..." }`

**Response 200:** Same shape as register (wrapped in `data`), plus the user's `roles`.

#### `POST /auth/refresh`
**Body:** `{ "refreshToken": "eyJ..." }`

**Response 200:** `{ "data": { "accessToken": "...", "refreshToken": "..." } }` (both are re-issued).

### 6.2 Tenants (`/tenants`)

Protected. All routes require `authenticate` + `tenantMiddleware`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `POST` | `/` | super_admin | Create tenant (name, slug, optional domain) |
| `GET` | `/` | super_admin, platform_admin | List with `?skip=0&take=20` (max 100) |
| `GET` | `/:id` | any | Get one |
| `PATCH` | `/:id` | super_admin, tenant_owner | Update name, domain, paymentProvider |
| `DELETE` | `/:id` | super_admin | Hard delete (204) |

**Validation:** `name` 1–255 chars, `slug` 1–100 chars matching `^[a-z0-9-]+$`, `domain` must be a URL, `paymentProvider` ∈ `['stripe','paypal','razorpay','braintree']`.

### 6.3 Users (`/users`)

Protected. Tenant-scoped.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `POST` | `/invite` | super_admin, tenant_owner, tenant_admin | Body: `email`, `firstName?`, `lastName?`, `roles[]` |
| `GET` | `/` | any | Lists users in caller's tenant |
| `GET` | `/:id` | any | Single user (must be in same tenant) |
| `PATCH` | `/:id` | super_admin, tenant_owner, tenant_admin | Update firstName, lastName, status |
| `DELETE` | `/:id` | super_admin, tenant_owner, tenant_admin | Hard delete |
| `POST` | `/:id/roles` | (any auth) | Body: `{ roleName }` — assign a role |
| `DELETE` | `/:id/roles` | (any auth) | Body: `{ roleName }` — remove a role (204) |

> **Note:** The role-assign endpoint is currently unguarded beyond authentication. Treat role names as `tenant_owner`, `tenant_admin`, `billing_manager`, `developer`, or `viewer` (for tenant scope) or `super_admin` / `platform_admin` (for platform scope). Calling with a platform-scope role while a tenant user is logged in is a no-op for the user's tenant.

### 6.4 Plans (`/plans`)

Protected. Tenant-scoped.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `POST` | `/` | super_admin, tenant_owner, tenant_admin | Create plan |
| `GET` | `/` | any | List active plans for tenant |
| `GET` | `/:id` | any | Single plan |
| `PATCH` | `/:id` | super_admin, tenant_owner, tenant_admin | Partial update incl. `isActive` |
| `DELETE` | `/:id` | super_admin, tenant_owner, tenant_admin | Hard delete (204) |

**Create body:**
```json
{
  "name": "Pro Monthly",
  "description": "For power users",
  "amount": 2900,
  "currency": "USD",
  "interval": "MONTH",
  "intervalCount": 1,
  "trialDays": 7
}
```

> `amount` is in the smallest currency unit (cents). `interval` ∈ `['DAY','WEEK','MONTH','YEAR']`.

### 6.5 Subscriptions (`/subscriptions`)

Protected. Tenant-scoped.

| Method | Path | Roles | Notes |
|---|---|---|---|
| `POST` | `/` | tenant_owner, tenant_admin, billing_manager | Create subscription |
| `GET` | `/` | any | List tenant's subscriptions |
| `GET` | `/:id` | any | Single subscription |
| `POST` | `/:id/cancel` | tenant_owner, tenant_admin, billing_manager | Body: `{ immediately: false }` |
| `POST` | `/:id/pause` | tenant_owner, tenant_admin, billing_manager | Pause billing |
| `POST` | `/:id/resume` | tenant_owner, tenant_admin, billing_manager | Resume billing |

**Create body:**
```json
{
  "planId": "uuid",
  "paymentMethodId": "cus_stripe_customer_id"
}
```

> **Important:** Before this works, the tenant's `paymentProvider` must be set (`PATCH /tenants/:id` with `paymentProvider: "stripe"`). Otherwise the service throws `BadRequestException: "Tenant has not configured a payment provider"`.

> **Stripe-specific quirk:** in the current Stripe implementation, the `paymentMethodId` field is treated as the **Stripe customer ID** (e.g. `cus_xxx`). A future revision should split this into separate `customerId` and `paymentMethodId` fields.

### 6.6 Webhooks (`/webhooks`)

`POST /webhooks?provider=stripe` (default provider is `stripe`).

Uses `express.raw({ type: 'application/json' })` — the body is a `Buffer`, not parsed JSON. The route is **not** behind `authenticate`. Authentication is by HMAC signature in the `stripe-signature` header.

Currently logs the event and returns `{ received: true, type: "..." }`. Dispatch to typed event handlers is a TODO.

---

## 7. Payment Gateway Abstraction

The whole point: **swap providers without touching domain code.**

### The Interface

`src/payments/gateway.interface.ts` defines `IPaymentGateway`:

```ts
interface IPaymentGateway {
  readonly provider: string;

  // Customer management
  createCustomer(data: CreateCustomerDto): Promise<GatewayCustomer>;
  deleteCustomer(customerId: string): Promise<void>;
  getCustomer(customerId: string): Promise<GatewayCustomer>;

  // Payment methods
  attachPaymentMethod(customerId: string, token: string): Promise<GatewayPaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]>;

  // Subscriptions
  createSubscription(data: CreateSubscriptionDto): Promise<GatewaySubscription>;
  cancelSubscription(subscriptionId: string, immediately: boolean): Promise<void>;
  pauseSubscription(subscriptionId: string): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;
  updateSubscription(id: string, data: UpdateSubscriptionDto): Promise<GatewaySubscription>;

  // Invoices
  createInvoice(data: CreateInvoiceDto): Promise<GatewayInvoice>;
  retryInvoice(invoiceId: string): Promise<GatewayInvoice>;
  getInvoice(invoiceId: string): Promise<GatewayInvoice>;

  // Webhooks
  constructWebhookEvent(payload: Buffer, signature: string): GatewayWebhookEvent;
}
```

### The Factory

`src/payments/gateway.factory.ts`:

```ts
const registry: Record<string, () => IPaymentGateway> = {
  stripe: () => new StripeGateway(),
};

export function getGateway(provider: string): IPaymentGateway {
  const factory = registry[provider];
  if (!factory) throw new BadRequestException(`Unsupported payment provider: ${provider}`);
  return factory();
}

export function registerGateway(provider: string, factory: () => IPaymentGateway): void {
  registry[provider] = factory;
}
```

The `subscription.service.ts` calls `getGateway(tenant.paymentProvider)` on every operation. The tenant chooses the provider at registration or by PATCHing the tenant record.

### Provider Status

| Provider | Status | Notes |
|---|---|---|
| Stripe | ✅ Implemented | Uses official `stripe@17` SDK. API version pinned to `2025-02-24.acacia`. |
| PayPal | 🟡 Stub | All methods throw `Error('PayPalGateway not yet implemented')` |
| Razorpay | 🟡 Stub | Same |
| Braintree | 🟡 Stub | Same |

### Adding a New Gateway

Three steps:

1. Create `src/payments/<provider>/<provider>.gateway.ts` implementing `IPaymentGateway`.
2. Register it in `gateway.factory.ts`:
   ```ts
   import { ProviderGateway } from './provider/provider.gateway';
   // ...
   const registry = {
     stripe: () => new StripeGateway(),
     provider: () => new ProviderGateway(),
   };
   ```
3. Add the provider name to the Zod enum in `tenant.dto.ts` (`paymentProvider` field).

---

## 8. Error Handling

`src/common/exceptions/index.ts` defines a base `AppError` and 5 typed subclasses:

| Class | HTTP | When |
|---|---|---|
| `BadRequestException` | 400 | Malformed input, missing header, unsupported gateway |
| `UnauthorizedException` | 401 | Missing/invalid/expired JWT, wrong token type |
| `ForbiddenException` | 403 | RBAC denial, tenant mismatch |
| `NotFoundException` | 404 | Resource doesn't exist (also: Prisma P2025) |
| `ConflictException` | 409 | Unique constraint violation (Prisma P2002) |

The `errorHandler.middleware.ts` catches:

- **`AppError`** → uses its `statusCode` and `code`
- **`ZodError`** → 400 with `code: 'VALIDATION_ERROR'` and a `details` array of `{ path, message }`
- **Prisma `P2002`** → 409 `UNIQUE_VIOLATION`
- **Prisma `P2025`** → 404 `NOT_FOUND`
- **Anything else** → 500 `INTERNAL_ERROR` (stack hidden in production)

### Response Shape

Success (most endpoints):
```json
{ "data": { ... } }
```

Error (from `errorHandler`):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "path": ["email"], "message": "Invalid email" }]
  }
}
```

> The 204 path (e.g. `DELETE`) returns an empty body, not a `{ data: null }` envelope.

---

## 9. Local Development Setup

### Prerequisites

- Node.js 20+
- Docker (the project uses Docker Compose for Postgres and Redis)
- A Stripe account (test mode) for end-to-end payment tests

### Step-by-step from a clean machine

```bash
# 1. Clone & enter
cd ~/Desktop/Subscription/subscription-service

# 2. Start Postgres + Redis
cd docker
docker compose up -d db redis
cd ..

# 3. Install dependencies
npm install

# 4. Create your .env
cp .env.example .env
# (Edit JWT_SECRET to a 32+ char random string.
#  Edit STRIPE_SECRET_KEY to a real sk_test_... from your Stripe dashboard.
#  Edit STRIPE_WEBHOOK_SECRET after step 8 below.)

# 5. Apply schema
npm run prisma:migrate
# (First run will prompt for a migration name — press Enter to accept the default.)

# 6. Seed roles + super admin
npm run seed

# 7. Start the API
npm run dev
# Output: [development] API running on http://localhost:3000

# 8. (Optional) Prisma Studio — visual DB admin
docker compose --project-directory docker up -d studio
# Open http://localhost:5555
```

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the API with `ts-node-dev` (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (production) |
| `npm run seed` | Run `scripts/seed.ts` |
| `npm run prisma:migrate` | `prisma migrate dev` — apply + create migration |
| `npm run prisma:studio` | Open Prisma Studio locally (or use Docker) |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |

### Running everything in Docker

If you prefer, the full stack can run in containers:

```bash
cd docker
docker compose up -d
docker compose exec api npm run prisma:migrate
docker compose exec api npm run seed
```

---

## 10. Testing Guide

The project ships **without automated tests yet** (Jest is installed but no `.spec.ts` files exist). This section covers what you can do today, plus a path for the future.

### 10.1 Manual API testing with curl

This is the fastest way to verify the whole stack. The flow exercises every layer: auth → tenants → users → plans → subscriptions → payment gateway.

> **Tip:** Most success responses are wrapped in `{ "data": { ... } }`. With `jq`, you can drill in with `... | jq .data` to get the payload directly. The examples below use this pattern.

#### Step 1 — Health check

```bash
curl -s http://localhost:3000/health | jq
```
Expected:
```json
{ "status": "ok", "timestamp": "2026-06-10T..." }
```

#### Step 2 — Login as the seeded super admin

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "changeme123"
  }' | jq .data
```
Save the `accessToken` and `refreshToken`:
```bash
export ADMIN_TOKEN="<paste accessToken here>"
export ADMIN_REFRESH="<paste refreshToken here>"
```

#### Step 3 — Register a tenant + tenant owner in one call

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme.com",
    "password": "supersecret123",
    "firstName": "Alice",
    "lastName": "Doe",
    "tenantName": "Acme Inc",
    "tenantSlug": "acme"
  }' | jq .data
```
Save Alice's token and tenantId:
```bash
export ALICE_TOKEN="<accessToken>"
export TENANT_ID="<user.tenantId>"
```

#### Step 4 — Verify tenant exists (platform view)

```bash
curl -s http://localhost:3000/api/v1/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .data
```

#### Step 5 — Set the tenant's payment provider

```bash
curl -s -X PATCH http://localhost:3000/api/v1/tenants/$TENANT_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "paymentProvider": "stripe" }' | jq .data
```

#### Step 6 — Create a plan (as Alice)

```bash
curl -s -X POST http://localhost:3000/api/v1/plans \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro Monthly",
    "description": "Power users",
    "amount": 2900,
    "currency": "USD",
    "interval": "MONTH",
    "intervalCount": 1,
    "trialDays": 7
  }' | jq .data
```
Save `id`:
```bash
export PLAN_ID="<id>"
```

#### Step 7 — Create a Stripe customer (manually, for testing)

Since the current `createSubscription` flow expects a Stripe customer ID in `paymentMethodId`, the easiest path is to use the Stripe dashboard or CLI to create a customer, then pass the ID.

Using the Stripe CLI:
```bash
# (Requires `stripe login` first)
stripe customers create --email alice@acme.com
# Returns: cus_xxxxx
```

#### Step 8 — Create a subscription

```bash
curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"paymentMethodId\": \"cus_xxxxx\"
  }" | jq .data
```
Expected: a JSON object with `status: "ACTIVE"`.

#### Step 9 — List subscriptions

```bash
curl -s http://localhost:3000/api/v1/subscriptions \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .data
```

#### Step 10 — Cancel at period end

```bash
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_ID/cancel \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "immediately": false }' | jq .data
```

#### Step 11 — Refresh the access token

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$ALICE_REFRESH\"}" | jq .data
```

#### Step 12 — Test RBAC denial

Try a call your role can't make (e.g. a viewer trying to delete a plan):

```bash
# Should fail with 403:
curl -s -X DELETE http://localhost:3000/api/v1/plans/$PLAN_ID \
  -H "Authorization: Bearer $VIEWER_TOKEN" -i | head -20
# Expected: HTTP/1.1 403 Forbidden
# Body: { "error": { "code": "FORBIDDEN", "message": "..." } }
```

### 10.2 Webhook testing with Stripe CLI

Stripe's CLI forwards webhook events to your local server, replacing the need for a public URL.

```bash
# 1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# 2. Forward events to localhost:3000
stripe listen --forward-to http://localhost:3000/api/v1/webhooks
# This prints a webhook signing secret: whsec_...
# Copy it into .env as STRIPE_WEBHOOK_SECRET
# Restart `npm run dev` to pick it up

# 3. In a second terminal, trigger a test event
stripe trigger customer.subscription.created

# 4. Watch the API logs — you should see:
#    [Webhook stripe] Event received: customer.subscription.created
#    {"received":true,"type":"customer.subscription.created"}
```

> **Why a raw body?** Stripe signs the *exact bytes* of the request. `express.json()` would re-serialize the body and break the HMAC. The webhook route uses `express.raw()` so the signature verifies.

### 10.3 Automated tests (future work)

Jest and `ts-jest` are wired in `package.json` but no specs exist. The recommended path:

```
src/modules/<name>/__tests__/
  ├── <name>.service.spec.ts     # unit: pure service logic, mock the repository
  ├── <name>.controller.spec.ts  # integration: route + middleware + service
```

For a service test, mock the repository:
```ts
// src/modules/plans/__tests__/plan.service.spec.ts
import { PlanService } from '../plan.service';
import { planRepository } from '../plan.repository';

jest.mock('../plan.repository');

describe('PlanService', () => {
  it('creates a plan for the given tenant', async () => {
    (planRepository.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Pro' });
    const svc = new PlanService();
    const result = await svc.create('tenant-1', { name: 'Pro', amount: 100, ... });
    expect(planRepository.create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
  });
});
```

For an integration test, use `supertest` against `createApp()` and a real (or testcontainer) Postgres.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `P1001: Can't reach database server at localhost:5432` | Postgres not running | `cd docker && docker compose up -d db redis` |
| `P3009: migrate found failed migrations` | Drift between schema and DB | `npx prisma migrate reset` (dev only) |
| `JsonWebTokenError: invalid signature` | `JWT_SECRET` changed between issuance and verification | Use a stable `JWT_SECRET` in `.env`, never edit it after tokens are issued |
| `JsonWebTokenError: jwt expired` | Access token past 15m | Call `/auth/refresh` with the refresh token |
| Stripe call: `No API key provided` | `STRIPE_SECRET_KEY` missing in `.env` | Add it; restart `npm run dev` |
| Stripe call: `No signatures found matching the expected signature for payload` | Wrong `STRIPE_WEBHOOK_SECRET`, or body was parsed by `express.json` | Confirm `.env` matches the value printed by `stripe listen`; the webhook route must use `express.raw()` |
| 403 on every request even though the user has roles | Token issued before roles were added | Log in again to get a token with current roles |
| 400 `Tenant has not configured a payment provider` on `POST /subscriptions` | `tenant.paymentProvider` is null | `PATCH /tenants/:id` with `paymentProvider: "stripe"` |
| `Unsupported payment provider: paypal` | Trying to use a stubbed gateway | Use Stripe, or implement the gateway |
| DBeaver `Connection refused` on `localhost:5432` | Same as the `P1001` case | Start Postgres via Docker Compose |

---

## Appendix: Environment Variables

All variables are read once at startup in `src/config/`.

| Name | Required | Default | Description | Vault path mapping |
|---|---|---|---|---|
| `PORT` | no | `3000` | HTTP port | — |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` | — |
| `API_PREFIX` | no | `/api/v1` | Route mount prefix | — |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allowlist | — |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string | `secret/data/subscription-service/{env}/database` |
| `DB_POOL_SIZE` | no | `20` | Prisma connection pool size | — |
| `REDIS_URL` | yes (future) | `redis://:@localhost:6379` | Redis connection (used by future BullMQ + rate limiter) | `secret/data/subscription-service/{env}/redis` |
| `JWT_SECRET` | **yes** | dev fallback | Min 32 chars in production | `secret/data/subscription-service/{env}/auth` |
| `JWT_REFRESH_SECRET` | **yes** | dev fallback | Min 32 chars in production | `secret/data/subscription-service/{env}/auth` |
| `JWT_EXPIRES_IN` | no | `15m` | Access token TTL | — |
| `JWT_REFRESH_EXPIRES_IN` | no | `30d` | Refresh token TTL | — |
| `STRIPE_SECRET_KEY` | yes for Stripe | — | `sk_test_...` or `sk_live_...` | `secret/data/subscription-service/{env}/gateways` |
| `STRIPE_WEBHOOK_SECRET` | yes for webhooks | — | `whsec_...` from Stripe CLI or dashboard | `secret/data/subscription-service/{env}/gateways` |
| `ENCRYPTION_KEY` | future | — | 32-byte base64 for tenant credential encryption | `secret/data/subscription-service/shared/encryption-key` |

> **Production note:** replace all `dev fallback` secrets with real, randomly generated 32+ char strings. Vault integration is deferred — the `.env.example` comments document which paths each variable should eventually live under.
