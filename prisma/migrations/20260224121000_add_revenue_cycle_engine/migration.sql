CREATE TYPE "RevenueCycleStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "RevenueCalculationMode" AS ENUM ('ON_GENERATED_FEE', 'ON_COLLECTED_FEE');

ALTER TABLE "OrganizationPlan"
ADD COLUMN "revenueCalculationMode" "RevenueCalculationMode" NOT NULL DEFAULT 'ON_GENERATED_FEE',
ADD COLUMN "perStudentFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "closingDay" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "RevenueCycle" (
  "id" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "revenueModeUsed" "RevenueCalculationMode" NOT NULL,
  "perStudentFee" DECIMAL(12,2) NOT NULL,
  "totalStudents" INTEGER NOT NULL DEFAULT 0,
  "generatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "collectedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sairexRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "RevenueCycleStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueAdjustment" (
  "id" TEXT NOT NULL,
  "revenueCycleId" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueCycle_organizationId_month_year_key"
ON "RevenueCycle"("organizationId", "month", "year");

CREATE INDEX "RevenueCycle_organizationId_status_idx"
ON "RevenueCycle"("organizationId", "status");

CREATE INDEX "RevenueAdjustment_revenueCycleId_idx"
ON "RevenueAdjustment"("revenueCycleId");

CREATE INDEX "RevenueAdjustment_organizationId_createdAt_idx"
ON "RevenueAdjustment"("organizationId", "createdAt");

ALTER TABLE "RevenueCycle"
ADD CONSTRAINT "RevenueCycle_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueAdjustment"
ADD CONSTRAINT "RevenueAdjustment_revenueCycleId_fkey"
FOREIGN KEY ("revenueCycleId") REFERENCES "RevenueCycle"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueAdjustment"
ADD CONSTRAINT "RevenueAdjustment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

