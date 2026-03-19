-- Add social links to Organization profile (branding/contact)

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;

