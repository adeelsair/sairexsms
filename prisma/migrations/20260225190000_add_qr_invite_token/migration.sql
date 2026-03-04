CREATE TABLE "QRInviteToken" (
  "id" TEXT NOT NULL,
  "organizationId" VARCHAR(11) NOT NULL,
  "role" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QRInviteToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QRInviteToken_organizationId_idx"
ON "QRInviteToken"("organizationId");

CREATE INDEX "QRInviteToken_organizationId_role_idx"
ON "QRInviteToken"("organizationId", "role");

CREATE INDEX "QRInviteToken_expiresAt_idx"
ON "QRInviteToken"("expiresAt");
