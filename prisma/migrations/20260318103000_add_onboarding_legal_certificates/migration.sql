-- Persist onboarding/legal certificate uploads on Organization

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "registrationCertificateUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationCertName" TEXT,
  ADD COLUMN IF NOT EXISTS "ntnCertificateUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "ntnCertName" TEXT;

