"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  School,
  GraduationCap,
  Briefcase,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Shield,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxDataTable,
  SxAmount,
  type SxColumn,
} from "@/components/sx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

type RiskLevel = "critical" | "warning" | "healthy" | "empty";

interface CoverageRow {
  unitName: string;
  unitPath: string;
  admins: number;
  campuses: number;
  students: number;
  staff: number;
  revenue: number;
  studentsPerAdmin: number | null;
  revenuePerAdmin: number | null;
  riskLevel: RiskLevel;
}

interface CoverageResponse {
  ok: boolean;
  data: CoverageRow[];
  error?: string;
}

type CoverageLevel = "ORG" | "REGION" | "SUBREGION" | "ZONE" | "CAMPUS";

const LEVEL_OPTIONS: { value: CoverageLevel; label: string }[] = [
  { value: "ORG", label: "Organization (summary)" },
  { value: "REGION", label: "By Region" },
  { value: "SUBREGION", label: "By Sub-Region" },
  { value: "ZONE", label: "By Zone" },
  { value: "CAMPUS", label: "By Campus" },
];

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; variant: "destructive" | "warning" | "success" | "default" }
> = {
  critical: { label: "Critical", variant: "destructive" },
  warning: { label: "Heavy", variant: "warning" },
  healthy: { label: "Balanced", variant: "success" },
  empty: { label: "Empty", variant: "default" },
};

/* ══════════════════════════════════════════════════════════════
   Column Definitions
   ══════════════════════════════════════════════════════════════ */

const columns: SxColumn<CoverageRow>[] = [
  {
    key: "unitName",
    header: "Unit",
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-foreground">{row.unitName}</p>
        {row.unitPath && (
          <p className="font-mono text-xs text-muted-foreground">
            {row.unitPath}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "admins",
    header: "Admins",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">{row.admins}</span>
    ),
  },
  {
    key: "campuses",
    header: "Campuses",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">{row.campuses}</span>
    ),
  },
  {
    key: "students",
    header: "Students",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">
        {row.students.toLocaleString()}
      </span>
    ),
  },
  {
    key: "staff",
    header: "Staff",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">{row.staff}</span>
    ),
  },
  {
    key: "revenue",
    header: "Revenue",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount amount={row.revenue} />,
  },
  {
    key: "studentsPerAdmin",
    header: "Students / Admin",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">
        {row.studentsPerAdmin !== null
          ? row.studentsPerAdmin.toLocaleString()
          : "—"}
      </span>
    ),
  },
  {
    key: "revenuePerAdmin",
    header: "Revenue / Admin",
    numeric: true,
    mono: true,
    render: (row) =>
      row.revenuePerAdmin !== null ? (
        <SxAmount amount={row.revenuePerAdmin} />
      ) : (
        <span className="font-data text-sm text-muted-foreground">—</span>
      ),
  },
  {
    key: "riskLevel",
    header: "Risk",
    render: (row) => {
      const config = RISK_CONFIG[row.riskLevel];
      return (
        <SxStatusBadge variant={config.variant}>
          {config.label}
        </SxStatusBadge>
      );
    },
  },
];

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function AccessCoveragePage() {
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<CoverageLevel>("REGION");
  const [scopeFilter, setScopeFilter] = useState("");

  /* ── Data fetching ──────────────────────────────────────── */

  const fetchCoverage = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set("level", level);
    if (scopeFilter.trim()) params.set("unitPath", scopeFilter.trim());

    const result = await api.get<CoverageResponse>(
      `/api/analytics/access-coverage?${params.toString()}`,
    );

    if (result.ok && result.data.ok) {
      setRows(result.data.data);
    } else if (result.ok && !result.data.ok) {
      toast.error(result.data.error ?? "Failed to load coverage data");
    } else if (!result.ok) {
      toast.error(result.error);
    }

    setLoading(false);
  }, [level, scopeFilter]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  /* ── Computed metrics ───────────────────────────────────── */

  const totals = rows.reduce(
    (acc, r) => ({
      admins: acc.admins + r.admins,
      campuses: acc.campuses + r.campuses,
      students: acc.students + r.students,
      staff: acc.staff + r.staff,
      revenue: acc.revenue + r.revenue,
    }),
    { admins: 0, campuses: 0, students: 0, staff: 0, revenue: 0 },
  );

  const criticalUnits = rows.filter((r) => r.riskLevel === "critical");
  const warningUnits = rows.filter((r) => r.riskLevel === "warning");

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Access Coverage"
        subtitle="RBAC scope mapped to real organizational data — campuses, students, staff, and revenue"
        actions={
          <SxButton
            sxVariant="outline"
            icon={<BarChart3 size={16} />}
            onClick={fetchCoverage}
          >
            Refresh
          </SxButton>
        }
      />

      {/* ── Controls ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="w-56 space-y-1">
          <label className="text-xs font-medium text-muted">
            Group by
          </label>
          <Select
            value={level}
            onValueChange={(v) => setLevel(v as CoverageLevel)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48 space-y-1">
          <label className="text-xs font-medium text-muted">
            Scope filter
          </label>
          <Input
            placeholder="e.g. R01"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          />
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────── */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            icon={<Users size={18} />}
            label="Admins"
            value={totals.admins}
          />
          <SummaryCard
            icon={<School size={18} />}
            label="Campuses"
            value={totals.campuses}
          />
          <SummaryCard
            icon={<GraduationCap size={18} />}
            label="Students"
            value={totals.students}
          />
          <SummaryCard
            icon={<Briefcase size={18} />}
            label="Staff"
            value={totals.staff}
          />
          <SummaryCard
            icon={<Wallet size={18} />}
            label="Revenue"
            value={totals.revenue}
            isCurrency
          />
        </div>
      )}

      {/* ── Risk alerts ───────────────────────────────────── */}
      {!loading && criticalUnits.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle size={16} />
            {criticalUnits.length} critical{" "}
            {criticalUnits.length === 1 ? "unit" : "units"} — no admin or
            severely overloaded
          </div>
          <div className="flex flex-wrap gap-1.5">
            {criticalUnits.map((u) => (
              <SxStatusBadge key={u.unitPath} variant="destructive">
                {u.unitName}
                {u.admins === 0
                  ? " (no admin)"
                  : ` (${u.studentsPerAdmin?.toLocaleString()} students/admin)`}
              </SxStatusBadge>
            ))}
          </div>
        </div>
      )}

      {!loading && warningUnits.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-warning-foreground">
            <TrendingUp size={16} />
            {warningUnits.length} {warningUnits.length === 1 ? "unit" : "units"}{" "}
            with heavy admin workload
          </div>
          <div className="flex flex-wrap gap-1.5">
            {warningUnits.map((u) => (
              <SxStatusBadge key={u.unitPath} variant="warning">
                {u.unitName} ({u.studentsPerAdmin?.toLocaleString()}{" "}
                students/admin)
              </SxStatusBadge>
            ))}
          </div>
        </div>
      )}

      {/* ── Healthy summary ───────────────────────────────── */}
      {!loading &&
        rows.length > 0 &&
        criticalUnits.length === 0 &&
        warningUnits.length === 0 && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <Shield size={16} />
              All units are balanced — admin workload is healthy across the
              organization
            </div>
          </div>
        )}

      {/* ── Data table ────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <SxDataTable
          columns={columns}
          data={rows as (CoverageRow & Record<string, unknown>)[]}
          loading={loading}
          rowKey={(row) => row.unitPath || "__org__"}
          emptyMessage="No coverage data available for the selected scope"
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Summary Card Component
   ══════════════════════════════════════════════════════════════ */

function SummaryCard({
  icon,
  label,
  value,
  isCurrency = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-2 font-data text-xl font-bold text-foreground">
        {isCurrency ? (
          <SxAmount amount={value} className="text-xl font-bold" />
        ) : (
          value.toLocaleString()
        )}
      </p>
    </div>
  );
}
