-- Approach A: introduce plan_prices table; Plan gains productId + features.
-- Legacy cadence fields on Plan remain (NOT NULL → NULLABLE) for back-compat.

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('RECURRING', 'ONE_TIME');
CREATE TYPE "UsageType" AS ENUM ('LICENSED', 'METERED');
CREATE TYPE "PriceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable Plan: add nullable productId + features; relax NOT NULL on legacy cadence fields
ALTER TABLE "plans"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "features" JSONB;

-- Make legacy cadence fields nullable (they were NOT NULL before)
ALTER TABLE "plans"
  ALTER COLUMN "amount" DROP NOT NULL,
  ALTER COLUMN "currency" DROP NOT NULL,
  ALTER COLUMN "interval" DROP NOT NULL,
  ALTER COLUMN "intervalCount" DROP NOT NULL,
  ALTER COLUMN "trialDays" DROP NOT NULL;

-- Make slug NOT NULL (was nullable; existing rows already backfilled)
ALTER TABLE "plans" ALTER COLUMN "slug" SET NOT NULL;

-- Backfill productId from existing gatewayPlanId for legacy rows so the new code can find them.
-- Legacy gatewayPlanId was a price_...; we don't have the prod_... here. Leave productId NULL —
-- the smoke-test migration script will create PlanPrice rows for legacy plans.

-- CreateTable plan_prices
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "gatewayPriceId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval",
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "type" "PriceType" NOT NULL DEFAULT 'RECURRING',
    "usageType" "UsageType" NOT NULL DEFAULT 'LICENSED',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "nickname" TEXT,
    "status" "PriceStatus" NOT NULL DEFAULT 'DRAFT',
    "gatewaySyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_prices_planId_idx" ON "plan_prices"("planId");
CREATE INDEX "plan_prices_status_idx" ON "plan_prices"("status");

ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE;

-- AlterTable Subscription: add planPriceId + addons
ALTER TABLE "subscriptions"
  ADD COLUMN "planPriceId" TEXT,
  ADD COLUMN "addons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
