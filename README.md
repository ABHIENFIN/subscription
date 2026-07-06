# Subscription Microservice

Payment-agnostic, multi-tenant subscription billing service built in Node.js + TypeScript.

## Prerequisites

- **Node.js 20+**
- **PostgreSQL** (via Docker or native install)
- **Redis** (optional — needed for future features)
- **Docker** (optional — for Postgres/Redis containers)

## Quick Start

### Option A: Docker for database (recommended)

```bash
# 1. Start Postgres + Redis via Docker
cd docker
docker compose up -d db redis
cd ..

# 2. Install dependencies
npm install

# 3. Copy environment config
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# 4. Run database migrations
npm run prisma:migrate

# 5. Seed default roles + super_admin user
npm run seed

# 6. Start the API
npm run dev
```

### Option B: Native Postgres (Docker optional)

```bash
# If you have Postgres running locally on :5432:
brew install postgresql@16
brew services start postgresql@16

# Then skip docker step and continue from npm install
```

## Starting the Server

**IMPORTANT:** Always use `src/main.ts`, not `src/app.ts`:

```bash
# The correct way (uses main.ts which calls createApp().listen()):
npm run dev
```

If you see "site can't be reached" errors, the dev script may be pointing to the wrong file. To fix:

```bash
# Edit package.json, change:
# "dev": "ts-node-dev --respawn --transpile-only src/app.ts"
# to:
# "dev": "ts-node-dev --respawn --transpile-only src/main.ts"

# Or run directly:
node_modules/.bin/ts-node-dev --respawn --transpile-only src/main.ts
```

## Verify It's Working

```bash
# Health check — should return {"status":"ok"}
curl http://localhost:3000/health

# Swagger UI — interactive API docs
open http://localhost:3000/docs

# ReDoc — alternative docs
open http://localhost:3000/redoc

# Raw OpenAPI spec JSON
curl http://localhost:3000/openapi.json
```

## API Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/v1/auth/register` | POST | Register new user |
| `/api/v1/auth/login` | POST | Login, get JWT |
| `/api/v1/auth/refresh` | POST | Refresh tokens |
| `/api/v1/tenants` | GET | List tenants (platform) |
| `/api/v1/tenants` | POST | Create tenant (platform) |
| `/api/v1/users` | GET | List tenant users |
| `/api/v1/users/:id` | GET | Get user |
| `/api/v1/plans` | GET | List plans |
| `/api/v1/plans` | POST | Create plan |
| `/api/v1/subscriptions` | GET | List subscriptions |
| `/api/v1/subscriptions` | POST | Create subscription |

**📚 Full API reference:** Visit `http://localhost:3000/docs` after starting the server.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | no | `3000` | HTTP port |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` |
| `API_PREFIX` | no | `/api/v1` | Route mount prefix |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allowlist |
| `DATABASE_URL` | **yes** | — | `postgresql://user:pass@host:5432/db` |
| `DB_POOL_SIZE` | no | `20` | Prisma connection pool |
| `REDIS_URL` | no | `redis://:@localhost:6379` | Redis for future use |
| `JWT_SECRET` | **yes** | dev fallback | Min 32 chars in production |
| `JWT_REFRESH_SECRET` | **yes** | dev fallback | Min 32 chars in production |
| `JWT_EXPIRES_IN` | no | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | no | `30d` | Refresh token TTL |
| `STRIPE_SECRET_KEY` | for Stripe | — | `sk_test_...` from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | for webhooks | — | `whsec_...` from Stripe CLI |
| `ENCRYPTION_KEY` | future | — | 32-byte base64 key |

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Site can't be reached" on localhost:3000 | `dev` script runs `app.ts` which doesn't call `listen()` | Use `src/main.ts` instead (see Starting the Server above) |
| Redis container stuck in "Created" state | Port 6379 already in use by native Redis | Use native Redis or change Docker port |
| `P1001: Can't reach database server` | Postgres not running | `cd docker && docker compose up -d db redis` |
| `JsonWebTokenError: invalid signature` | `JWT_SECRET` changed after tokens issued | Use stable secret; re-login |
| `Tenant has not configured a payment provider` | `tenant.paymentProvider` is null | `PATCH /api/v1/tenants/:id` with `paymentProvider: "stripe"` |

## Docker

The `docker/` stack provides Postgres, Redis, and Prisma Studio.

**Pattern A — run DB in Docker, app on host (recommended for development):**
```bash
cd docker
docker compose up -d db redis       # start Postgres + Redis
cd ..
npm run prisma:migrate              # runs on host, talks to db:5432
npm run seed
npm run dev                         # API runs on host
```

**Pattern B — run everything in Docker:**
```bash
cd docker
docker compose up -d                 # starts db, redis, api, studio
docker compose exec api npm run prisma:migrate
docker compose exec api npm run seed
```

**Port conflicts:** If port 6379 (Redis) or 5432 (Postgres) is already in use (e.g., a native install), the Docker container will fail to start. Check with:
```bash
lsof -i :6379    # Redis
lsof -i :5432    # Postgres
```

Either stop the conflicting process, or change the port mapping in `docker/docker-compose.yml`.

## Default Credentials

After seeding:
- Email: `admin@example.com`
- Password: `changeme123`

## Architecture

- **Auth**: JWT (access + refresh tokens)
- **RBAC**: Two-tier roles (platform + tenant)
- **Payment**: Strategy Pattern — swap gateways without touching core logic
- **Database**: PostgreSQL + Prisma ORM

## Payment Gateways

| Gateway | Status |
|----------|--------|
| Stripe | Implemented |
| PayPal | Stub |
| Razorpay | Stub |
| Braintree | Stub |