ALTER TABLE "OrganizationPlan"
ADD COLUMN "trialPlanType" "PlanType" DEFAULT 'PRO',
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3);
