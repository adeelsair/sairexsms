import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { loadAdminDashboard } from "@/lib/dashboard/dashboard.loader";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    redirect("/login");
  }

  const dashboard = await loadAdminDashboard(guard);
  if (dashboard.mode === "SIMPLE" && !dashboard.isSuperAdmin) {
    redirect("/mobile/dashboard");
  }

  return (
    <DashboardClient
      initialStats={dashboard.stats}
      initialMode={dashboard.mode}
      isSuperAdmin={dashboard.isSuperAdmin}
      hasOrganizationContext={dashboard.hasOrganizationContext}
      initialTenants={dashboard.tenants}
      isImpersonating={dashboard.isImpersonating}
      initialPlanUsage={dashboard.planUsage}
    />
  );
}
  