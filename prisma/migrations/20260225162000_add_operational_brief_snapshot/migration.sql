CREATE TABLE "OperationalBriefSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalBriefSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalBriefSnapshot_organizationId_idx"
ON "OperationalBriefSnapshot"("organizationId");

CREATE INDEX "OperationalBriefSnapshot_organizationId_createdAt_idx"
ON "OperationalBriefSnapshot"("organizationId", "createdAt");
