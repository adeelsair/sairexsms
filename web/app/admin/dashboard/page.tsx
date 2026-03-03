"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import {
  PlanUsageCard,
  SxButton,
  SxDataTable,
  SxPageHeader,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardStat extends Record<string, unknown> {
  key: string;
  label: string;
  value: number | string;
  format?: "number" | "currency" | "percent";
}

interface DashboardStatsEnvelope {
  stats: DashboardStat[];
}

interface OrganizationModeEnvelope {
  organizationId: string | null;
  mode: "SIMPLE" | "PRO";
  isSimple: boolean;
  isSuperAdmin?: boolean;
}

interface OrganizationModeUpdateEnvelope {
  ok: boolean;
  organizationId: string;
  mode: "SIMPLE" | "PRO";
}

interface DemoSchoolResponse {
  ok: boolean;
  data: {
    organizationId: string;
    organizationName: string;
    demoRedirect: string;
  };
  error?: string;
}

interface ImpersonationTenant {
  id: string;
  name: string;
}

interface ImpersonationListResponse {
  ok: boolean;
  data: {
    tenants: ImpersonationTenant[];
  };
}

interface ImpersonationStartResponse {
  ok: boolean;
  data: {
    tenantId: string;
    tenantName: string;
    expiresAt: string;
  };
}

type TrendTone = "growth" | "decline" | "neutral";

const columns: SxColumn<DashboardStat>[] = [
  {
    key: "label",
    header: "Metric",
    render: (row) => <span className="font-medium">{row.label}</span>,
  },
  {
    key: "value",
    header: "Value",
    numeric: true,
    mono: true,
    render: (row) => <span className="font-data">{String(row.value)}</span>,
  },
];

function formatStatValue(stat: DashboardStat): string {
  if (typeof stat.value === "string") return stat.value;
  if (stat.format === "currency") return `Rs ${stat.value.toLocaleString("en-PK")}`;
  if (stat.format === "percent") return `${stat.value}%`;
  return stat.value.toLocaleString("en-PK");
}

function resolveTrendTone(stat: DashboardStat): TrendTone {
  if (typeof stat.value !== "number") return "neutral";
  if (stat.format !== "percent") return "neutral";
  if (stat.value > 0) return "growth";
  if (stat.value < 0) return "decline";
  return "neutral";
}

function trendClass(tone: TrendTone): string {
  if (tone === "growth") return "text-[var(--sx-success)]";
  if (tone === "decline") return "text-[var(--sx-danger)]";
  return "text-muted";
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isImpersonating = Boolean(
    (session?.user as { impersonation?: boolean } | undefined)?.impersonation,
  );
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"SIMPLE" | "PRO" | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasOrganizationContext, setHasOrganizationContext] = useState(true);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [tenants, setTenants] = useState<ImpersonationTenant[]>([]);
  const [targetTenantId, setTargetTenantId] = useState<string>("");
  const [startingImpersonation, setStartingImpersonation] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const result = await api.get<DashboardStatsEnvelope>("/api/dashboard?view=stats");
    if (result.ok) {
      setStats(result.data.stats);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  const fetchMode = useCallback(async () => {
    const result = await api.get<OrganizationModeEnvelope>("/api/organizations/mode");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setIsSuperAdmin(Boolean(result.data.isSuperAdmin));
    setHasOrganizationContext(Boolean(result.data.organizationId));
    setMode(result.data.mode);
    if (result.data.isSimple && !result.data.isSuperAdmin) {
      router.replace("/mobile/dashboard");
    }
  }, [router]);

  const loadImpersonationTargets = useCallback(async () => {
    const result = await api.get<ImpersonationListResponse>("/api/superadmin/impersonate");
    if (!result.ok || !result.data.ok) {
      if (result.ok && !result.data.ok) {
        toast.error("Failed to load tenant list");
      } else {
        toast.error(result.ok ? "Failed to load tenant list" : (result.error ?? "Failed to load tenant list"));
      }
      return;
    }

    setTenants(result.data.data.tenants);
  }, []);

  const toggleMode = useCallback(async () => {
    if (!mode) return;
    if (!hasOrganizationContext) return;
    setSwitchingMode(true);
    const nextMode = mode === "SIMPLE" ? "PRO" : "SIMPLE";
    const result = await api.patch<OrganizationModeUpdateEnvelope>("/api/organizations/mode", {
      mode: nextMode,
    });
    setSwitchingMode(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setMode(result.data.mode);
    toast.success(
      result.data.mode === "PRO"
        ? "Pro mode enabled"
        : "Simple mode enabled",
    );
    if (result.data.mode === "SIMPLE" && !isSuperAdmin) {
      router.replace("/mobile/dashboard");
      return;
    }
    fetchStats();
  }, [fetchStats, hasOrganizationContext, isSuperAdmin, mode, router]);

  const generateDemo = useCallback(async () => {
    setIsGeneratingDemo(true);
    const result = await api.post<DemoSchoolResponse>("/api/super-admin/demo/generate");
    setIsGeneratingDemo(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to generate demo school");
      return;
    }

    toast.success(`Demo ready: ${result.data.data.organizationName}`);
    router.push(result.data.data.demoRedirect);
  }, [router]);

  const resetDemo = useCallback(async () => {
    setIsResettingDemo(true);
    const result = await api.post<DemoSchoolResponse>("/api/super-admin/demo/reset");
    setIsResettingDemo(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to reset demo school");
      return;
    }

    toast.success("Demo reset complete");
    router.push(result.data.data.demoRedirect);
  }, [router]);

  const startImpersonation = useCallback(async () => {
    if (!targetTenantId) {
      toast.error("Select a tenant first");
      return;
    }

    setStartingImpersonation(true);
    const result = await api.post<ImpersonationStartResponse>("/api/superadmin/impersonate", {
      targetId: targetTenantId,
    });
    setStartingImpersonation(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (!result.data.ok) {
      toast.error("Failed to start impersonation");
      return;
    }

    toast.success(`Impersonation started for ${result.data.data.tenantName}`);
    router.refresh();
  }, [router, targetTenantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMode();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMode]);

  useEffect(() => {
    if (isSuperAdmin && !isImpersonating) {
      const timer = window.setTimeout(() => {
        void loadImpersonationTargets();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isImpersonating, isSuperAdmin, loadImpersonationTargets]);

  useEffect(() => {
    if (mode === "SIMPLE") return;
    const timer = window.setTimeout(() => {
      void fetchStats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStats, mode]);

  const subtitle = useMemo(() => {
    return "Live operational snapshot with plan usage and key metrics";
  }, []);

  return (
    <div className="min-w-0 space-y-6 bg-background">
      <SxPageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <SxStatusBadge variant="success">Live</SxStatusBadge>
            {hasOrganizationContext ? (
              <SxButton sxVariant="secondary" loading={switchingMode} onClick={toggleMode}>
                {mode === "PRO" ? "Switch to Simple" : "Switch to Pro"}
              </SxButton>
            ) : null}
            {isSuperAdmin ? (
              <>
                {!isImpersonating ? (
                  <>
                    <Select value={targetTenantId} onValueChange={setTargetTenantId}>
                      <SelectTrigger className="w-full min-w-0 border-2 text-foreground data-[placeholder]:text-foreground sm:w-64">
                        <SelectValue
                          className="font-medium data-[placeholder]:text-foreground"
                          placeholder="Select Organization"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <SxButton
                      sxVariant="outline"
                      loading={startingImpersonation}
                      onClick={startImpersonation}
                    >
                      Enter
                    </SxButton>
                    <SxButton sxVariant="outline" loading={isGeneratingDemo} onClick={generateDemo}>
                      Generate Demo School
                    </SxButton>
                    <SxButton sxVariant="outline" loading={isResettingDemo} onClick={resetDemo}>
                      Reset Demo
                    </SxButton>
                  </>
                ) : null}
              </>
            ) : null}
            <SxButton sxVariant="outline" onClick={fetchStats}>
              Refresh
            </SxButton>
          </div>
        }
      />

      <PlanUsageCard />

      {stats.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats.slice(0, 4).map((stat) => {
            const tone = resolveTrendTone(stat);
            return (
              <article key={stat.key} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold">{formatStatValue(stat)}</p>
                <p className={`mt-1 text-xs ${trendClass(tone)}`}>
                  {tone === "growth" ? "Growth" : tone === "decline" ? "Decline" : "Neutral"}
                </p>
              </article>
            );
          })}
        </section>
      ) : null}

      <SxDataTable
        className="rounded-xl border-border bg-surface"
        columns={columns}
        data={stats}
        loading={loading}
        emptyMessage="No dashboard metrics available."
      />
    </div>
  );
}
  