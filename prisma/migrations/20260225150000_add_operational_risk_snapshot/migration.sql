CREATE TABLE "OperationalRiskSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalRiskSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationalRiskSnapshot"
ADD CONSTRAINT "OperationalRiskSnapshot_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OperationalRiskSnapshot_organizationId_idx"
ON "OperationalRiskSnapshot"("organizationId");

CREATE INDEX "OperationalRiskSnapshot_organizationId_createdAt_idx"
ON "OperationalRiskSnapshot"("organizationId", "createdAt");
