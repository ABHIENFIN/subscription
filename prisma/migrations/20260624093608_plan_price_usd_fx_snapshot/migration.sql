-- DropForeignKey
ALTER TABLE "plan_prices" DROP CONSTRAINT "plan_prices_planId_fkey";

-- AlterTable
ALTER TABLE "plan_prices" ADD COLUMN     "amountUsdCents" INTEGER,
ADD COLUMN     "fxAsOf" TIMESTAMP(3),
ADD COLUMN     "fxRate" DECIMAL(18,8),
ADD COLUMN     "fxSource" TEXT;

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "intervalCount" DROP DEFAULT,
ALTER COLUMN "trialDays" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill USD rows: identity conversion (1 USD = 1 USD).
-- Non-USD rows are left NULL — they need republish to capture an FX rate.
UPDATE "plan_prices"
SET "amountUsdCents" = "amount",
    "fxRate"         = 1.0,
    "fxAsOf"         = NOW(),
    "fxSource"       = 'identity'
WHERE "currency" = 'USD';
