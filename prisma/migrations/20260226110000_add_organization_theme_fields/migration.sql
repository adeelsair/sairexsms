-- Add tenant runtime theme fields on organization.
ALTER TABLE "Organization"
ADD COLUMN "primaryColor" VARCHAR(7),
ADD COLUMN "accentColor" VARCHAR(7),
ADD COLUMN "themeMode" TEXT DEFAULT 'light';

