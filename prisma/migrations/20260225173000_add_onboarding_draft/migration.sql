CREATE TABLE "OnboardingDraft" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "schoolInfo" JSONB,
  "academicSetup" JSONB,
  "feeSetup" JSONB,
  "adminSetup" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingDraft_token_key"
ON "OnboardingDraft"("token");

CREATE INDEX "OnboardingDraft_status_createdAt_idx"
ON "OnboardingDraft"("status", "createdAt");
