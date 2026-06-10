# Subscription Microservice

Payment-agnostic, multi-tenant subscription billing service built in Node.js.

## Quick Start

You need **Docker** running locally — it provides Postgres and Redis. (No local Postgres install required.)

```bash
# 1. Start the database & Redis (Postgres on :5432, Redis on :6379, Studio on :5555)
cd docker
docker compose up -d db redis
cd ..

# 2. Install dependencies
npm install

# 3. Copy environment config
cp .env.example .env
# Edit .env with your JWT_SECRET and STRIPE_SECRET_KEY (DATABASE_URL is fine as-is)

# 4. Run database migrations
npm run prisma:migrate

# 5. Seed default roles
npm run seed

# 6. Start the API
npm run dev
```

If you prefer not to use Docker, you can run a local Postgres on `:5432` instead and the rest of the steps are the same.

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

## Environment Variables

See `.env.example` for all required variables. Values map to Vault paths for production (see design doc for Vault integration).

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