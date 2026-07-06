-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "plans"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "gatewaySyncedAt" TIMESTAMP(3),
  ADD COLUMN "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill slugs for existing rows (name -> kebab-case)
UPDATE "plans"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE("name", 'plan'), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+)|(-+$)', '', 'g'))
WHERE "slug" IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE "plans" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex (unique on tenantId, slug)
CREATE UNIQUE INDEX "plans_tenantId_slug_key" ON "plans"("tenantId", "slug");

-- CreateIndex (status)
CREATE INDEX "plans_status_idx" ON "plans"("status");
