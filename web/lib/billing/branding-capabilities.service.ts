import { getOrganizationPlan } from "@/lib/feature-gate";
import {
  getBrandingCapabilities,
  toPublicPlan,
  type BrandingCapabilities,
  type PublicPlanName,
} from "@/lib/billing/pricing-architecture";

export interface OrganizationBrandingCapabilities {
  plan: PublicPlanName;
  capabilities: BrandingCapabilities;
  trialActive: boolean;
}

export async function resolveOrganizationBrandingCapabilities(
  organizationId: string,
): Promise<OrganizationBrandingCapabilities> {
  const planSummary = await getOrganizationPlan(organizationId);
  const plan = toPublicPlan(planSummary.effectivePlanType);

  return {
    plan,
    capabilities: getBrandingCapabilities(plan),
    trialActive: planSummary.trialActive,
  };
}

