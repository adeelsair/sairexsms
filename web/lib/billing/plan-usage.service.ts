import { prisma } from "@/lib/prisma";
import type { PlanType } from "@/lib/generated/prisma";
import { getOrganizationPlan } from "@/lib/feature-gate";
import {
  getBrandingCapabilities,
  publicPlanToPricingTier,
  recommendedPlanByStudentCount,
  toPublicPlan,
  type BrandingCapabilities,
  type PublicPlanName,
} from "@/lib/billing/pricing-architecture";

export interface PlanUsagePayload {
  plan: PublicPlanName;
  limits: {
    students: number;
    campuses: number;
    staff: number;
  };
  usage: {
    students: number;
    campuses: number;
    staff: number;
  };
  pricing: {
    model: "PER_STUDENT_MONTH";
    currency: "PKR";
    monthlyPerStudentPkr: { min: number; max: number };
    annualPrepayDiscountPercent: number;
  };
  tier: {
    studentBand: { min: number; max: number | null };
    features: string[];
  };
  trial: {
    active: boolean;
    fullFeature: boolean;
    noCreditCardRequired: boolean;
    endsAt: string | null;
    daysLeft: number;
  };
  upgradePath: {
    suggestedPlan: PublicPlanName;
    simpleToProRecommended: boolean;
    reason: string | null;
  };
  branding: BrandingCapabilities;
}

const DEFAULT_LIMITS_BY_PLAN: Record<PlanType, { students: number; campuses: number; staff: number }> = {
  FREE: { students: 200, campuses: 1, staff: 10 },
  BASIC: { students: 500, campuses: 2, staff: 20 },
  PRO: { students: 2000, campuses: 10, staff: 100 },
  ENTERPRISE: { students: 10000, campuses: 100, staff: 1000 },
};

const STAFF_FEATURE_KEYS = ["STAFF_USERS", "STAFF_LIMIT", "MAX_STAFF"];
const CAMPUS_FEATURE_KEYS = ["MAX_CAMPUSES", "CAMPUS_LIMIT"];

function daysLeftFrom(end: Date | null): number {
  if (!end) return 0;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export async function getOrganizationPlanUsage(
  organizationId: string,
): Promise<PlanUsagePayload> {
  const orgPlan = await prisma.organizationPlan.findUnique({
    where: { organizationId },
    select: {
      planType: true,
      maxStudents: true,
      maxCampuses: true,
    },
  });

  const planSummary = await getOrganizationPlan(organizationId);
  const planType: PlanType = planSummary.effectivePlanType;
  const defaults = DEFAULT_LIMITS_BY_PLAN[planSummary.planType];

  const [studentsCount, campusesCount, staffCount, staffFeature, campusFeature] =
    await Promise.all([
      prisma.student.count({ where: { organizationId } }),
      prisma.campus.count({
        where: { organizationId, status: "ACTIVE", deletedAt: null },
      }),
      prisma.membership.count({
        where: {
          organizationId,
          status: "ACTIVE",
          role: {
            in: [
              "ORG_ADMIN",
              "REGION_ADMIN",
              "SUBREGION_ADMIN",
              "ZONE_ADMIN",
              "CAMPUS_ADMIN",
              "TEACHER",
              "ACCOUNTANT",
              "STAFF",
            ],
          },
        },
      }),
      prisma.planFeature.findFirst({
        where: { planType, featureKey: { in: STAFF_FEATURE_KEYS }, enabled: true },
        select: { limit: true },
      }),
      prisma.planFeature.findFirst({
        where: { planType, featureKey: { in: CAMPUS_FEATURE_KEYS }, enabled: true },
        select: { limit: true },
      }),
    ]);

  const plan = toPublicPlan(planType);
  const tier = publicPlanToPricingTier(plan);
  const branding = getBrandingCapabilities(plan);
  const suggestedPlan = recommendedPlanByStudentCount(studentsCount);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { mode: true },
  });
  const simpleToProRecommended =
    (organization?.mode ?? "SIMPLE") === "SIMPLE" &&
    suggestedPlan !== "STARTER";

  return {
    plan,
    limits: {
      students: orgPlan?.maxStudents ?? defaults.students,
      campuses: orgPlan?.maxCampuses ?? campusFeature?.limit ?? defaults.campuses,
      staff: staffFeature?.limit ?? defaults.staff,
    },
    usage: {
      students: studentsCount,
      campuses: campusesCount,
      staff: staffCount,
    },
    pricing: {
      model: "PER_STUDENT_MONTH",
      currency: "PKR",
      monthlyPerStudentPkr: tier.monthlyPerStudentPkr,
      annualPrepayDiscountPercent: 15,
    },
    tier: {
      studentBand: tier.studentBand,
      features: tier.features,
    },
    trial: {
      active: planSummary.trialActive,
      fullFeature: true,
      noCreditCardRequired: true,
      endsAt: planSummary.trialEndsAt?.toISOString() ?? null,
      daysLeft: daysLeftFrom(planSummary.trialEndsAt),
    },
    upgradePath: {
      suggestedPlan,
      simpleToProRecommended,
      reason: simpleToProRecommended
        ? "Student growth suggests enabling PRO mode for predictive insights."
        : null,
    },
    branding,
  };
}

