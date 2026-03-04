import { isSuperAdmin, type AuthUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getOrganizationPlanUsage, type PlanUsagePayload } from "@/lib/billing/plan-usage.service";
import { resolveOrganizationMode, type OrganizationMode } from "@/lib/system/mode.service";
import { getDashboardStats, type QuickStat } from "@/lib/adoption/dashboard.service";

export interface DashboardTenantOption {
  id: string;
  name: string;
}

export interface AdminDashboardPayload {
  stats: QuickStat[];
  mode: OrganizationMode | null;
  isSuperAdmin: boolean;
  hasOrganizationContext: boolean;
  planUsage: PlanUsagePayload | null;
  tenants: DashboardTenantOption[];
  isImpersonating: boolean;
}

async function loadImpersonationTargets(guard: AuthUser): Promise<DashboardTenantOption[]> {
  if (!isSuperAdmin(guard) || guard.impersonation) return [];
  const organizations = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      organizationName: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return organizations.map((org) => ({
    id: org.id,
    name: org.displayName || org.organizationName,
  }));
}

export async function loadAdminDashboard(guard: AuthUser): Promise<AdminDashboardPayload> {
  const orgId = guard.organizationId;
  if (!orgId) {
    return {
      stats: [],
      mode: null,
      isSuperAdmin: isSuperAdmin(guard),
      hasOrganizationContext: false,
      planUsage: null,
      tenants: await loadImpersonationTargets(guard),
      isImpersonating: guard.impersonation,
    };
  }

  const [stats, modeResolved, planUsage, tenants] = await Promise.all([
    getDashboardStats(guard),
    resolveOrganizationMode(orgId),
    getOrganizationPlanUsage(orgId),
    loadImpersonationTargets(guard),
  ]);

  return {
    stats,
    mode: modeResolved.mode,
    isSuperAdmin: isSuperAdmin(guard),
    hasOrganizationContext: true,
    planUsage,
    tenants,
    isImpersonating: guard.impersonation,
  };
}
