import type { PlanType } from "@/lib/generated/prisma";

export type PublicPlanName = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export type BrandingCapabilities = {
  customLogo: boolean;
  customPrimaryColor: boolean;
  customLoginTheme: boolean;
  removePoweredBy: boolean;
};

export interface PricingTierDefinition {
  plan: PublicPlanName;
  studentBand: { min: number; max: number | null };
  monthlyPerStudentPkr: { min: number; max: number };
  features: string[];
  simpleModeDefault: boolean;
  proModeAvailable: boolean;
}

export const PAKISTAN_PRICING_ARCHITECTURE: PricingTierDefinition[] = [
  {
    plan: "STARTER",
    studentBand: { min: 100, max: 400 },
    monthlyPerStudentPkr: { min: 40, max: 60 },
    features: [
      "Action dashboard",
      "Attendance",
      "Basic fee management",
      "Parent app",
      "QR onboarding",
      "SIMPLE mode",
    ],
    simpleModeDefault: true,
    proModeAvailable: false,
  },
  {
    plan: "PROFESSIONAL",
    studentBand: { min: 401, max: 1500 },
    monthlyPerStudentPkr: { min: 70, max: 90 },
    features: [
      "Predictive fee risk",
      "Attendance risk",
      "Student stability index",
      "Principal intelligence summary",
      "Advanced fee structures",
      "PRO mode access",
    ],
    simpleModeDefault: false,
    proModeAvailable: true,
  },
  {
    plan: "ENTERPRISE",
    studentBand: { min: 1501, max: null },
    monthlyPerStudentPkr: { min: 0, max: 0 },
    features: [
      "Multi-campus",
      "Central dashboard",
      "Impersonation",
      "Executive BI",
      "Chain control panel",
      "Custom commercial model",
    ],
    simpleModeDefault: false,
    proModeAvailable: true,
  },
];

const BRANDING_CAPABILITIES_BY_PLAN: Record<PublicPlanName, BrandingCapabilities> = {
  STARTER: {
    customLogo: false,
    customPrimaryColor: false,
    customLoginTheme: false,
    removePoweredBy: false,
  },
  PROFESSIONAL: {
    customLogo: true,
    customPrimaryColor: true,
    customLoginTheme: false,
    removePoweredBy: false,
  },
  ENTERPRISE: {
    customLogo: true,
    customPrimaryColor: true,
    customLoginTheme: true,
    removePoweredBy: true,
  },
};

export const BRANDING_PLAN_MATRIX = Object.entries(BRANDING_CAPABILITIES_BY_PLAN).map(
  ([plan, capabilities]) => ({
    plan: plan as PublicPlanName,
    ...capabilities,
  }),
);

export const TRIAL_POLICY = {
  days: 30,
  fullFeature: true,
  noCreditCardRequired: true,
  trialPlanType: "PRO" as PlanType,
} as const;

export function toPublicPlan(planType: PlanType): PublicPlanName {
  if (planType === "PRO") return "PROFESSIONAL";
  if (planType === "ENTERPRISE") return "ENTERPRISE";
  return "STARTER";
}

export function publicPlanToPricingTier(plan: PublicPlanName): PricingTierDefinition {
  const found = PAKISTAN_PRICING_ARCHITECTURE.find((tier) => tier.plan === plan);
  if (found) return found;
  return PAKISTAN_PRICING_ARCHITECTURE[0];
}

export function getBrandingCapabilities(plan: PublicPlanName): BrandingCapabilities {
  return BRANDING_CAPABILITIES_BY_PLAN[plan];
}

export function recommendedPlanByStudentCount(studentCount: number): PublicPlanName {
  if (studentCount > 1500) return "ENTERPRISE";
  if (studentCount > 400) return "PROFESSIONAL";
  return "STARTER";
}

export function createTrialWindow(fromDate: Date = new Date()) {
  const trialStartedAt = new Date(fromDate);
  const trialEndsAt = new Date(fromDate);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_POLICY.days);
  return { trialStartedAt, trialEndsAt };
}
