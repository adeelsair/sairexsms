CREATE TABLE "MobileActionLog" (
  "id" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "userId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "lastShownAt" TIMESTAMP(3) NOT NULL,
  "lastActedAt" TIMESTAMP(3),
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MobileActionLog_organizationId_userId_idx"
ON "MobileActionLog"("organizationId", "userId");

CREATE UNIQUE INDEX "MobileActionLog_organizationId_userId_actionKey_key"
ON "MobileActionLog"("organizationId", "userId", "actionKey");
