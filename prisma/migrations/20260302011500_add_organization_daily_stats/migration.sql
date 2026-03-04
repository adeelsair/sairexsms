-- CreateTable
CREATE TABLE "OrganizationDailyStats" (
  "organizationId" VARCHAR(11) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "studentCount" INTEGER NOT NULL DEFAULT 0,
  "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attendanceCount" INTEGER NOT NULL DEFAULT 0,
  "challanCount" INTEGER NOT NULL DEFAULT 0,
  "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationDailyStats_pkey" PRIMARY KEY ("organizationId","date")
);

-- CreateIndex
CREATE INDEX "OrganizationDailyStats_organizationId_idx" ON "OrganizationDailyStats"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationDailyStats"
ADD CONSTRAINT "OrganizationDailyStats_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
