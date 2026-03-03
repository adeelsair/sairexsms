-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "organizationId" VARCHAR(11),
  "campusId" INTEGER,
  "membershipId" INTEGER,
  "organizationStructure" TEXT,
  "unitPath" TEXT,
  "role" TEXT,
  "platformRole" TEXT,
  "impersonation" BOOLEAN NOT NULL DEFAULT false,
  "impersonationOriginalUserId" INTEGER,
  "impersonationEffectiveUserId" INTEGER,
  "impersonationTenantId" VARCHAR(11),
  "impersonationExpiresAt" TIMESTAMP(3),
  "originalOrganizationId" VARCHAR(11),
  "originalCampusId" INTEGER,
  "originalMembershipId" INTEGER,
  "originalOrganizationStructure" TEXT,
  "originalUnitPath" TEXT,
  "originalRole" TEXT,
  "originalPlatformRole" TEXT,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_organizationId_idx" ON "Session"("organizationId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- AddForeignKey
ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
