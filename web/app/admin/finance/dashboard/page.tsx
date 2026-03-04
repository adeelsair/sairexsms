"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";

import { api } from "@/lib/api-client";
import { OrgRevenueDrawer } from "@/components/admin/finance/org-revenue-drawer";
import {
  SxAmount,
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

interface FinanceDashboardResponse {
  period: { month: number; year: number };
  kpis: {
    mrrClosed: number;
    projectedMrr: number;
    collectedAmount: number;
    generatedAmount: number;
    collectionRate: number;
    collectionEfficiency: number;
    activePayingStudents: number;
    arpuPerStudent: number;
    overdueCycles: number;
    atRiskMrr: number;
    momChange: {
      mrrPercent: number;
      studentsPercent: number;
      arpuPercent: number;
    };
  };
  trend: Array<{
    month: number;
    year: number;
    label: string;
    mrr: number;
    collectedAmount: number;
  }>;
  organizationTable: OrganizationRevenueRow[];
  modeDistribution: {
    onGeneratedFeeOrganizations: number;
    onCollectedFeeOrganizations: number;
  };
  automationHealth: {
    lastCronActivityAt: string | null;
    failedOrganizationsLast24h: number;
    autoClosedEventsLast24h: number;
    lockSkipsLast24h: number;
  };
  alerts: Array<{
    severity: "info" | "warning";
    message: string;
  }>;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

interface OrganizationModeEnvelope {
  organizationId: string;
  mode: "SIMPLE" | "PRO";
  isSimple: boolean;
}

interface OrganizationRevenueRow {
  organizationId: string;
  organizationName: string;
  students: number;
  mode: "ON_GENERATED_FEE" | "ON_COLLECTED_FEE";
  planType: "FREE" | "BASIC" | "PRO" | "ENTERPRISE" | "UNASSIGNED";
  revenue: number;
  collectedPercent: number;
  status: "OPEN" | "CLOSED" | "OVERDUE";
  risk: "LOW" | "MEDIUM" | "HIGH";
  riskTrend: "IMPROVING" | "WORSENING" | "STABLE";
}

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const columns: SxColumn<OrganizationRevenueRow>[] = [
  {
    key: "organizationName",
    header: "Organization",
    render: (row) => <span className="font-medium">{row.organizationName}</span>,
  },
  {
    key: "students",
    header: "Students",
    numeric: true,
    mono: true,
    render: (row) => <span className="font-data">{row.students}</span>,
  },
  {
    key: "mode",
    header: "Mode",
    render: (row) => (
      <SxStatusBadge variant="info">
        {row.mode === "ON_GENERATED_FEE" ? "Generated" : "Collected"}
      </SxStatusBadge>
    ),
  },
  {
    key: "revenue",
    header: "Revenue",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.revenue} />,
  },
  {
    key: "collectedPercent",
    header: "Collected %",
    numeric: true,
    mono: true,
    render: (row) => <span className="font-data">{row.collectedPercent.toFixed(1)}%</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={statusVariant(row.status)}>{row.status}</SxStatusBadge>
    ),
  },
  {
    key: "risk",
    header: "Risk",
    render: (row) => (
      <div className="flex items-center gap-2">
        <SxStatusBadge variant={riskVariant(row.risk)}>{row.risk}</SxStatusBadge>
        <SxRiskTrendBadge trend={row.riskTrend} />
      </div>
    ),
  },
];

export default function FinanceDashboardPage() {
  const router = useRouter();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMode, setSelectedMode] = useState<"ALL" | "ON_GENERATED_FEE" | "ON_COLLECTED_FEE">("ALL");
  const [selectedPlanType, setSelectedPlanType] = useState<"ALL" | "FREE" | "BASIC" | "PRO" | "ENTERPRISE">("ALL");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [modeChecked, setModeChecked] = useState(false);

  const checkMode = useCallback(async () => {
    const result = await api.get<OrganizationModeEnvelope>("/api/organizations/mode");
    if (!result.ok) {
      toast.error(result.error);
      setModeChecked(true);
      return;
    }
    if (result.data.isSimple) {
      toast.error("This area is available in Pro mode.");
      router.replace("/admin/dashboard");
      return;
    }
    setModeChecked(true);
  }, [router]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams({
      month: selectedMonth,
      year: selectedYear,
      revenueMode: selectedMode,
      planType: selectedPlanType,
    });

    const result = await api.get<ApiEnvelope<FinanceDashboardResponse>>(
      `/api/finance/dashboard?${params.toString()}`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load finance dashboard");
      setLoading(false);
      return;
    }

    setDashboard(result.data.data);
    setLoading(false);
  }, [selectedMonth, selectedMode, selectedPlanType, selectedYear]);

  useEffect(() => {
    checkMode();
  }, [checkMode]);

  useEffect(() => {
    if (!modeChecked) return;
    fetchDashboard();
  }, [fetchDashboard, modeChecked]);

  if (!modeChecked) {
    return (
      <div className="space-y-6">
        <SxPageHeader title="Finance Dashboard" subtitle="Checking access mode..." />
      </div>
    );
  }

  const maxTrendValue = useMemo(() => {
    if (!dashboard || dashboard.trend.length === 0) return 0;
    return Math.max(...dashboard.trend.map((point) => point.mrr), 1);
  }, [dashboard]);

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Finance Dashboard"
        subtitle="Super Admin revenue control tower built on cycle snapshots"
        actions={(
          <SxButton sxVariant="outline" icon={<RefreshCcw size={14} />} onClick={fetchDashboard}>
            Refresh
          </SxButton>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <FilterCard
          label="Month"
          control={(
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FilterCard
          label="Year"
          control={(
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions(now.getFullYear()).map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FilterCard
          label="Revenue Mode"
          control={(
            <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as "ALL" | "ON_GENERATED_FEE" | "ON_COLLECTED_FEE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ON_GENERATED_FEE">On Generated Fee</SelectItem>
                <SelectItem value="ON_COLLECTED_FEE">On Collected Fee</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FilterCard
          label="Plan"
          control={(
            <Select value={selectedPlanType} onValueChange={(value) => setSelectedPlanType(value as "ALL" | "FREE" | "BASIC" | "PRO" | "ENTERPRISE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="MRR (Closed)"
          value={<SxAmount value={dashboard?.kpis.mrrClosed ?? 0} />}
          changePercent={dashboard?.kpis.momChange.mrrPercent}
        />
        <KpiCard
          label="Paying Students"
          value={String(dashboard?.kpis.activePayingStudents ?? 0)}
          changePercent={dashboard?.kpis.momChange.studentsPercent}
        />
        <KpiCard
          label="ARPU / Student"
          value={<SxAmount value={dashboard?.kpis.arpuPerStudent ?? 0} />}
          changePercent={dashboard?.kpis.momChange.arpuPercent}
        />
        <KpiCard label="Projected MRR" value={<SxAmount value={dashboard?.kpis.projectedMrr ?? 0} />} />
        <KpiCard
          label="Collection Efficiency"
          value={`${(dashboard?.kpis.collectionEfficiency ?? 0).toFixed(1)}%`}
          emphasize
        />
        <KpiCard
          label="Overdue Cycles"
          value={String(dashboard?.kpis.overdueCycles ?? 0)}
          emphasize={(dashboard?.kpis.overdueCycles ?? 0) > 0}
        />
        <KpiCard
          label="At-Risk MRR"
          value={<SxAmount value={dashboard?.kpis.atRiskMrr ?? 0} />}
          emphasize={(dashboard?.kpis.atRiskMrr ?? 0) > 0}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Collected vs Generated</p>
          <p className="text-xs text-muted">
            {dashboard ? `${dashboard.kpis.collectedAmount.toFixed(0)} / ${dashboard.kpis.generatedAmount.toFixed(0)}` : "0 / 0"}
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary"
            style={{ width: `${Math.min(Math.max(dashboard?.kpis.collectionRate ?? 0, 0), 100)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-4 text-sm font-semibold">MRR Trend (last 12 closed months)</p>
          <div className="space-y-3">
            {(dashboard?.trend ?? []).map((point) => (
              <div key={`${point.year}-${point.month}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">{point.label}</span>
                  <span className="font-data"><SxAmount value={point.mrr} /></span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(point.mrr / maxTrendValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {dashboard?.trend.length === 0 && (
              <p className="text-sm text-muted">No closed-cycle trend data available.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold">Automation Health</p>
            <div className="space-y-2 text-sm">
              <Row label="Last activity" value={dashboard?.automationHealth.lastCronActivityAt ? new Date(dashboard.automationHealth.lastCronActivityAt).toLocaleString("en-PK") : "No run data"} />
              <Row label="Failed orgs (24h)" value={String(dashboard?.automationHealth.failedOrganizationsLast24h ?? 0)} />
              <Row label="Auto-closed (24h)" value={String(dashboard?.automationHealth.autoClosedEventsLast24h ?? 0)} />
              <Row label="Lock skips (24h)" value={String(dashboard?.automationHealth.lockSkipsLast24h ?? 0)} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold">Alerts & Insights</p>
            <div className="space-y-2">
              {(dashboard?.alerts ?? []).map((alert, index) => (
                <div key={`${alert.message}-${index}`} className="rounded-md bg-muted p-2">
                  <SxStatusBadge variant={alert.severity === "warning" ? "warning" : "info"}>
                    {alert.severity.toUpperCase()}
                  </SxStatusBadge>
                  <p className="mt-1 text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold">Mode Distribution</p>
            <Row
              label="Generated Fee Orgs"
              value={String(dashboard?.modeDistribution.onGeneratedFeeOrganizations ?? 0)}
            />
            <Row
              label="Collected Fee Orgs"
              value={String(dashboard?.modeDistribution.onCollectedFeeOrganizations ?? 0)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <SxDataTable
          columns={columns}
          data={dashboard?.organizationTable ?? []}
          onRowClick={(row) => {
            setSelectedOrganizationId(row.organizationId);
            setDrawerOpen(true);
          }}
          loading={loading}
          emptyMessage="No organization revenue data for selected filters."
        />
      </div>

      <OrgRevenueDrawer
        organizationId={selectedOrganizationId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function statusVariant(status: OrganizationRevenueRow["status"]): "success" | "warning" | "info" {
  if (status === "CLOSED") return "success";
  if (status === "OVERDUE") return "warning";
  return "info";
}

function riskVariant(risk: OrganizationRevenueRow["risk"]): "success" | "warning" | "info" {
  if (risk === "HIGH") return "warning";
  if (risk === "MEDIUM") return "info";
  return "success";
}

function yearOptions(currentYear: number): number[] {
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
}

function FilterCard(props: { label: string; control: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {props.label}
      </p>
      {props.control}
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: ReactNode;
  changePercent?: number;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {props.label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`text-sm ${props.emphasize ? "font-bold text-primary" : "font-semibold"}`}>
          {props.value}
        </p>
        {typeof props.changePercent === "number" && <KpiDelta changePercent={props.changePercent} />}
      </div>
    </div>
  );
}

function KpiDelta(props: { changePercent: number }) {
  const positive = props.changePercent >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? "text-success" : "text-destructive"}`}>
      {positive ? "↑" : "↓"} {Math.abs(props.changePercent).toFixed(1)}%
    </span>
  );
}

function SxRiskTrendBadge(props: { trend: "IMPROVING" | "WORSENING" | "STABLE" }) {
  if (props.trend === "WORSENING") {
    return <SxStatusBadge variant="destructive">↓</SxStatusBadge>;
  }
  if (props.trend === "IMPROVING") {
    return <SxStatusBadge variant="success">↑</SxStatusBadge>;
  }
  return <SxStatusBadge variant="outline">→</SxStatusBadge>;
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{props.label}</span>
      <span className="font-data text-xs">{props.value}</span>
    </div>
  );
}
