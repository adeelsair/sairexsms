"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import {
  SxAmount,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

interface OrgFinanceDetail {
  summary: {
    organizationName: string;
    planType: "FREE" | "BASIC" | "PRO" | "ENTERPRISE" | "UNASSIGNED";
    revenueMode: "ON_GENERATED_FEE" | "ON_COLLECTED_FEE" | null;
    perStudentFee: number | null;
    closingDay: number | null;
    currentMRR: number | null;
    studentCount: number | null;
    arpu: number | null;
    collectionRate: number | null;
  };
  cycles: Array<{
    id: string;
    month: number;
    year: number;
    students: number;
    revenue: number;
    generated: number;
    collected: number;
    status: "OPEN" | "CLOSED";
  }>;
  adjustments: Array<{
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
    createdBy: string;
  }>;
  recoveryTrend: Array<{
    month: number;
    year: number;
    generated: number;
    collected: number;
  }>;
  risk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
    deltas: {
      revenuePct?: number;
      students?: number;
      collectionRatePct?: number;
    };
  };
}

interface OrgRevenueDrawerProps {
  organizationId: string | null;
  open: boolean;
  onClose: () => void;
}

const cycleColumns: SxColumn<OrgFinanceDetail["cycles"][number]>[] = [
  {
    key: "period",
    header: "Month",
    render: (row) => <span>{monthLabel(row.month)} {row.year}</span>,
  },
  {
    key: "students",
    header: "Students",
    numeric: true,
    mono: true,
  },
  {
    key: "revenue",
    header: "Revenue",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.revenue} />,
  },
  {
    key: "generated",
    header: "Generated",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.generated} />,
  },
  {
    key: "collected",
    header: "Collected",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.collected} />,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={row.status === "CLOSED" ? "success" : "info"}>
        {row.status}
      </SxStatusBadge>
    ),
  },
];

const adjustmentColumns: SxColumn<OrgFinanceDetail["adjustments"][number]>[] = [
  {
    key: "createdAt",
    header: "Date",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleString("en-PK")}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.amount} />,
  },
  {
    key: "reason",
    header: "Reason",
    render: (row) => <span>{row.reason}</span>,
  },
  {
    key: "createdBy",
    header: "Created By",
    render: (row) => <span className="text-xs text-muted-foreground">{row.createdBy}</span>,
  },
];

export function OrgRevenueDrawer({ organizationId, open, onClose }: OrgRevenueDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<OrgFinanceDetail | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!organizationId || !open) return;
    setLoading(true);

    const result = await api.get<ApiEnvelope<OrgFinanceDetail>>(
      "/api/finance/dashboard/org",
    );

    if (!result.ok) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load organization detail");
      setLoading(false);
      return;
    }

    setDetail(result.data.data);
    setLoading(false);
  }, [open, organizationId]);

  useEffect(() => {
    if (open) {
      fetchDetail();
    } else {
      setDetail(null);
    }
  }, [fetchDetail, open]);

  const maxRecoveryValue = useMemo(() => {
    if (!detail || detail.recoveryTrend.length === 0) return 1;
    return Math.max(
      ...detail.recoveryTrend.map((item) => Math.max(item.generated, item.collected)),
      1,
    );
  }, [detail]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>{detail?.summary.organizationName ?? "Organization Detail"}</SheetTitle>
          <SheetDescription>
            Snapshot-first revenue detail and audit ledger
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SxButton
              sxVariant="outline"
              size="sm"
              onClick={() => toast.info("Connect this action with your CRM workflow")}
            >
              Contact Org
            </SxButton>
            <SxButton sxVariant="outline" size="sm" asChild>
              <Link href="/admin/organizations">View Billing Config</Link>
            </SxButton>
            <SxButton sxVariant="outline" size="sm" asChild>
              <Link href="/admin/finance/dashboard">View Revenue Cycles</Link>
            </SxButton>
          </div>
        </SheetHeader>

        {loading && (
          <div className="p-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && detail && (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SxStatusBadge variant="info">{detail.summary.planType}</SxStatusBadge>
              <SxStatusBadge variant="outline">
                {detail.summary.revenueMode === "ON_GENERATED_FEE" ? "On Generated Fee" : detail.summary.revenueMode === "ON_COLLECTED_FEE" ? "On Collected Fee" : "Not configured"}
              </SxStatusBadge>
              {detail.summary.closingDay !== null && (
                <SxStatusBadge variant="default">Closing Day {detail.summary.closingDay}</SxStatusBadge>
              )}
            </div>

            {detail.summary.currentMRR === null ? (
              <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                Revenue cycle not closed yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Current MRR" value={<SxAmount value={detail.summary.currentMRR} />} />
                <MetricCard label="Students" value={String(detail.summary.studentCount ?? 0)} />
                <MetricCard label="ARPU" value={<SxAmount value={detail.summary.arpu ?? 0} />} />
                <MetricCard label="Collection %" value={`${(detail.summary.collectionRate ?? 0).toFixed(1)}%`} />
              </div>
            )}

            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-semibold">Recovery Trend</p>
              <div className="space-y-2">
                {detail.recoveryTrend.map((point) => (
                  <div key={`${point.year}-${point.month}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{monthLabel(point.month)} {point.year}</span>
                      <span className="font-data">
                        <SxAmount value={point.collected} /> / <SxAmount value={point.generated} />
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-info"
                        style={{ width: `${(point.generated / maxRecoveryValue) * 100}%` }}
                      />
                      <div
                        className="-mt-2 h-2 rounded-full bg-primary"
                        style={{ width: `${(point.collected / maxRecoveryValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {detail.recoveryTrend.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recovery trend data yet.</p>
                )}
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${
              detail.risk.level === "HIGH"
                ? "bg-destructive/10"
                : detail.risk.level === "MEDIUM"
                  ? "bg-warning/15"
                  : "bg-success/15"
            }`}>
              <div className="mb-2 flex items-center gap-2">
                <SxStatusBadge variant={detail.risk.level === "HIGH" ? "destructive" : detail.risk.level === "MEDIUM" ? "warning" : "success"}>
                  {detail.risk.level} RISK
                </SxStatusBadge>
              </div>
              <ul className="space-y-1 text-sm">
                {detail.risk.reasons.map((reason, idx) => (
                  <li
                    key={`${reason}-${idx}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>- {reason}</span>
                    <RiskReasonDelta reason={reason} deltas={detail.risk.deltas} />
                  </li>
                ))}
              </ul>
            </div>

            <SxDataTable
              columns={cycleColumns}
              data={detail.cycles}
              emptyMessage="No revenue cycles yet."
            />

            <SxDataTable
              columns={adjustmentColumns}
              data={detail.adjustments}
              emptyMessage="No adjustments found."
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetricCard(props: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {props.label}
      </p>
      <p className="mt-1 text-sm font-semibold">{props.value}</p>
    </div>
  );
}

function monthLabel(month: number): string {
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return labels[month - 1] ?? `M${month}`;
}

function RiskReasonDelta(props: {
  reason: string;
  deltas: {
    revenuePct?: number;
    students?: number;
    collectionRatePct?: number;
  };
}) {
  if (props.reason.startsWith("MRR")) {
    return <SxDeltaBadge value={props.deltas.revenuePct} type="percent" />;
  }
  if (props.reason.startsWith("Student")) {
    return <SxDeltaBadge value={props.deltas.students} type="count" />;
  }
  if (props.reason.startsWith("Collection")) {
    return <SxDeltaBadge value={props.deltas.collectionRatePct} type="percent" />;
  }
  return null;
}

function SxDeltaBadge(props: { value?: number; type: "percent" | "count" }) {
  if (typeof props.value !== "number") return null;

  const positive = props.value > 0;
  const negative = props.value < 0;
  const variant = negative ? "destructive" : positive ? "success" : "outline";

  let label = "0";
  if (props.type === "percent") {
    if (positive) label = `↑ ${Math.abs(props.value).toFixed(1)}%`;
    if (negative) label = `↓ ${Math.abs(props.value).toFixed(1)}%`;
    if (!positive && !negative) label = "0.0%";
  } else {
    const rounded = Math.round(props.value);
    label = rounded > 0 ? `+${rounded}` : String(rounded);
  }

  return (
    <span className="inline-flex w-20 justify-end">
      <SxStatusBadge variant={variant}>{label}</SxStatusBadge>
    </span>
  );
}
