/**
 * Feature Gating — Backend Enforcement Layer
 *
 * Determines whether a feature is available to an organization
 * based on their subscription plan. Never trust frontend-only gating.
 *
 * Uses a two-layer system:
 *   1. OrganizationPlan — what plan the org is on
 *   2. PlanFeature — what features each plan includes
 *
 * Plan features are seeded via seedPlanFeatures() and cached in-memory.
 */
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { PlanType } from "@/lib/generated/prisma";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";

/* ── Feature Keys ─────────────────────────────────────── */

export const Features = {
  DIGITAL_PAYMENTS: "DIGITAL_PAYMENTS",
  WHATSAPP_REMINDERS: "WHATSAPP_REMINDERS",
  SMS_REMINDERS: "SMS_REMINDERS",
  MULTI_CAMPUS: "MULTI_CAMPUS",
  PROMOTION_ENGINE: "PROMOTION_ENGINE",
  ADVANCED_REPORTS: "ADVANCED_REPORTS",
  QR_TOKENS: "QR_TOKENS",
  BULK_IMPORT: "BULK_IMPORT",
  API_ACCESS: "API_ACCESS",
  CUSTOM_BRANDING: "CUSTOM_BRANDING",
  EVENT_WEBHOOKS: "EVENT_WEBHOOKS",
} as const;

export type FeatureKey = (typeof Features)[keyof typeof Features];

/* ── Default Plan Matrix ──────────────────────────────── */

const PLAN_DEFAULTS: Record<
  PlanType,
  Record<string, { enabled: boolean; limit?: number }>
> = {
  FREE: {
    [Features.DIGITAL_PAYMENTS]: { enabled: false },
    [Features.WHATSAPP_REMINDERS]: { enabled: false },
    [Features.SMS_REMINDERS]: { enabled: false },
    [Features.MULTI_CAMPUS]: { enabled: false },
    [Features.PROMOTION_ENGINE]: { enabled: true },
    [Features.ADVANCED_REPORTS]: { enabled: false },
    [Features.QR_TOKENS]: { enabled: true, limit: 50 },
    [Features.BULK_IMPORT]: { enabled: false },
    [Features.API_ACCESS]: { enabled: false },
    [Features.CUSTOM_BRANDING]: { enabled: false },
    [Features.EVENT_WEBHOOKS]: { enabled: false },
  },
  BASIC: {
    [Features.DIGITAL_PAYMENTS]: { enabled: true },
    [Features.WHATSAPP_REMINDERS]: { enabled: false },
    [Features.SMS_REMINDERS]: { enabled: true, limit: 500 },
    [Features.MULTI_CAMPUS]: { enabled: false },
    [Features.PROMOTION_ENGINE]: { enabled: true },
    [Features.ADVANCED_REPORTS]: { enabled: false },
    [Features.QR_TOKENS]: { enabled: true, limit: 500 },
    [Features.BULK_IMPORT]: { enabled: true },
    [Features.API_ACCESS]: { enabled: false },
    [Features.CUSTOM_BRANDING]: { enabled: false },
    [Features.EVENT_WEBHOOKS]: { enabled: false },
  },
  PRO: {
    [Features.DIGITAL_PAYMENTS]: { enabled: true },
    [Features.WHATSAPP_REMINDERS]: { enabled: true },
    [Features.SMS_REMINDERS]: { enabled: true, limit: 5000 },
    [Features.MULTI_CAMPUS]: { enabled: true },
    [Features.PROMOTION_ENGINE]: { enabled: true },
    [Features.ADVANCED_REPORTS]: { enabled: true },
    [Features.QR_TOKENS]: { enabled: true },
    [Features.BULK_IMPORT]: { enabled: true },
    [Features.API_ACCESS]: { enabled: false },
    [Features.CUSTOM_BRANDING]: { enabled: true },
    [Features.EVENT_WEBHOOKS]: { enabled: false },
  },
  ENTERPRISE: {
    [Features.DIGITAL_PAYMENTS]: { enabled: true },
    [Features.WHATSAPP_REMINDERS]: { enabled: true },
    [Features.SMS_REMINDERS]: { enabled: true },
    [Features.MULTI_CAMPUS]: { enabled: true },
    [Features.PROMOTION_ENGINE]: { enabled: true },
    [Features.ADVANCED_REPORTS]: { enabled: true },
    [Features.QR_TOKENS]: { enabled: true },
    [Features.BULK_IMPORT]: { enabled: true },
    [Features.API_ACCESS]: { enabled: true },
    [Features.CUSTOM_BRANDING]: { enabled: true },
    [Features.EVENT_WEBHOOKS]: { enabled: true },
  },
};

/* ── In-Memory Cache ──────────────────────────────────── */

let featureCache: Map<
  string,
  { enabled: boolean; limit?: number | null }
> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadFeatureCache(): Promise<
  Map<string, { enabled: boolean; limit?: number | null }>
> {
  if (featureCache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return featureCache;
  }

  const rows = await prisma.planFeature.findMany();
  const map = new Map<string, { enabled: boolean; limit?: number | null }>();

  for (const row of rows) {
    map.set(`${row.planType}:${row.featureKey}`, {
      enabled: row.enabled,
      limit: row.limit,
    });
  }

  featureCache = map;
  cacheLoadedAt = Date.now();
  return map;
}

export function invalidateFeatureCache(): void {
  featureCache = null;
  cacheLoadedAt = 0;
}

/* ── Core Gate Functions ──────────────────────────────── */

export async function getOrganizationPlan(organizationId: string): Promise<{
  planType: PlanType;
  effectivePlanType: PlanType;
  active: boolean;
  expired: boolean;
  trialActive: boolean;
  trialEndsAt: Date | null;
  maxStudents: number | null;
  maxCampuses: number | null;
}> {
  const plan = await prisma.organizationPlan.findUnique({
    where: { organizationId },
  });

  if (!plan) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { createdAt: true },
    });
    const { trialEndsAt } = createTrialWindow(org?.createdAt ?? new Date());
    const trialActive = Boolean(org?.createdAt) && new Date() <= trialEndsAt;

    return {
      planType: "FREE",
      effectivePlanType: trialActive ? TRIAL_POLICY.trialPlanType : "FREE",
      active: true,
      expired: false,
      trialActive,
      trialEndsAt: trialActive ? trialEndsAt : null,
      maxStudents: null,
      maxCampuses: null,
    };
  }

  const expired = plan.expiresAt ? new Date() > plan.expiresAt : false;
  const trialEndsAt = plan.trialEndsAt ?? null;
  const trialActive =
    trialEndsAt !== null &&
    !expired &&
    plan.active &&
    new Date() <= trialEndsAt;
  const effectivePlanType =
    trialActive
      ? plan.trialPlanType ?? TRIAL_POLICY.trialPlanType
      : plan.planType;

  return {
    planType: plan.planType,
    effectivePlanType,
    active: plan.active && !expired,
    expired,
    trialActive,
    trialEndsAt,
    maxStudents: plan.maxStudents,
    maxCampuses: plan.maxCampuses,
  };
}

export async function isFeatureEnabled(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<{ enabled: boolean; limit?: number | null }> {
  const orgPlan = await getOrganizationPlan(organizationId);

  if (!orgPlan.active) {
    return { enabled: false };
  }

  const cache = await loadFeatureCache();
  const cacheKey = `${orgPlan.effectivePlanType}:${featureKey}`;
  const cached = cache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const defaults = PLAN_DEFAULTS[orgPlan.effectivePlanType]?.[featureKey];
  return defaults
    ? { enabled: defaults.enabled, limit: defaults.limit }
    : { enabled: false };
}

/**
 * Backend guard — returns 403 NextResponse if the feature is disabled.
 * Use in API routes before executing feature-gated logic.
 */
export async function assertFeatureEnabled(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<NextResponse | null> {
  const result = await isFeatureEnabled(organizationId, featureKey);

  if (!result.enabled) {
    return NextResponse.json(
      {
        error: `This feature requires a plan upgrade`,
        code: "FEATURE_GATED",
        feature: featureKey,
      },
      { status: 403 },
    );
  }

  return null;
}

/* ── Plan Management ──────────────────────────────────── */

export async function setOrganizationPlan(
  organizationId: string,
  planType: PlanType,
  options?: {
    maxStudents?: number;
    maxCampuses?: number;
    expiresAt?: Date;
    trialPlanType?: PlanType | null;
    trialStartedAt?: Date | null;
    trialEndsAt?: Date | null;
  },
) {
  return prisma.organizationPlan.upsert({
    where: { organizationId },
    create: {
      organizationId,
      planType,
      maxStudents: options?.maxStudents,
      maxCampuses: options?.maxCampuses,
      expiresAt: options?.expiresAt,
      trialPlanType: options?.trialPlanType ?? undefined,
      trialStartedAt: options?.trialStartedAt ?? undefined,
      trialEndsAt: options?.trialEndsAt ?? undefined,
    },
    update: {
      planType,
      active: true,
      maxStudents: options?.maxStudents,
      maxCampuses: options?.maxCampuses,
      expiresAt: options?.expiresAt,
      trialPlanType: options?.trialPlanType ?? undefined,
      trialStartedAt: options?.trialStartedAt ?? undefined,
      trialEndsAt: options?.trialEndsAt ?? undefined,
    },
  });
}

/* ── Seed Plan Features ───────────────────────────────── */

export async function seedPlanFeatures(): Promise<number> {
  let count = 0;

  for (const [planType, features] of Object.entries(PLAN_DEFAULTS)) {
    for (const [featureKey, config] of Object.entries(features)) {
      await prisma.planFeature.upsert({
        where: {
          planType_featureKey: {
            planType: planType as PlanType,
            featureKey,
          },
        },
        create: {
          planType: planType as PlanType,
          featureKey,
          enabled: config.enabled,
          limit: config.limit,
        },
        update: {
          enabled: config.enabled,
          limit: config.limit,
        },
      });
      count++;
    }
  }

  invalidateFeatureCache();
  return count;
}
