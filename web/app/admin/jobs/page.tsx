"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Skull,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxDataTable,
  type SxColumn,
} from "@/components/sx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface JobRecord {
  id: string;
  type: string;
  queue: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  user: { email: string } | null;
}

interface JobsResponse {
  jobs: JobRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

/* ══════════════════════════════════════════════════════════════
   Status badge mapping
   ══════════════════════════════════════════════════════════════ */

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "info" | "default"> = {
  COMPLETED: "success",
  PROCESSING: "info",
  PENDING: "warning",
  FAILED: "destructive",
  DEAD: "destructive",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 size={12} />,
  PROCESSING: <Loader2 size={12} className="animate-spin" />,
  PENDING: <Clock size={12} />,
  FAILED: <XCircle size={12} />,
  DEAD: <Skull size={12} />,
};

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ══════════════════════════════════════════════════════════════
   Columns
   ══════════════════════════════════════════════════════════════ */

const columns: SxColumn<JobRecord>[] = [
  {
    key: "type",
    header: "Type",
    render: (j) => (
      <span className="font-mono text-xs font-medium">{j.type}</span>
    ),
  },
  {
    key: "queue",
    header: "Queue",
    render: (j) => <span className="text-xs text-muted-foreground">{j.queue}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (j) => (
      <SxStatusBadge variant={STATUS_VARIANT[j.status] ?? "default"}>
        <span className="inline-flex items-center gap-1">
          {STATUS_ICON[j.status]}
          {j.status}
        </span>
      </SxStatusBadge>
    ),
  },
  {
    key: "attempts",
    header: "Attempts",
    render: (j) => (
      <span className="text-xs">
        {j.attempts}/{j.maxAttempts}
      </span>
    ),
  },
  {
    key: "user",
    header: "Triggered By",
    render: (j) => (
      <span className="text-xs text-muted-foreground truncate max-w-[140px] inline-block">
        {j.user?.email ?? "system"}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (j) => <span className="text-xs text-muted-foreground">{timeAgo(j.createdAt)}</span>,
  },
  {
    key: "duration",
    header: "Duration",
    render: (j) => (
      <span className="text-xs">{duration(j.startedAt, j.completedAt ?? j.failedAt)}</span>
    ),
  },
];

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function JobMonitorPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("type", typeFilter);

    const result = await api.get<JobsResponse>(`/api/jobs?${params}`);
    if (result.ok) {
      setData(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchJobs]);

  const stats = data?.stats ?? {};
  const totalJobs = Object.values(stats).reduce((a, b) => a + b, 0);

  const JOB_TYPES = ["ALL", "EMAIL", "OTP", "SMS", "WHATSAPP", "NOTIFICATION", "CHALLAN_PDF", "REPORT", "BULK_SMS", "IMPORT"];

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Job Monitor"
        subtitle="Background job queue dashboard — track all async operations"
      >
        <div className="flex items-center gap-2">
          <SxButton
            size="sm"
            sxVariant={autoRefresh ? "primary" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Loader2 size={14} className="animate-spin mr-1" /> : <Clock size={14} className="mr-1" />}
            {autoRefresh ? "Live" : "Auto"}
          </SxButton>
          <SxButton size="sm" sxVariant="outline" onClick={fetchJobs} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </SxButton>
        </div>
      </SxPageHeader>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", count: totalJobs, icon: <Filter size={16} />, color: "text-foreground" },
          { label: "Pending", count: stats.PENDING ?? 0, icon: <Clock size={16} />, color: "text-warning" },
          { label: "Processing", count: stats.PROCESSING ?? 0, icon: <Loader2 size={16} className="animate-spin" />, color: "text-info" },
          { label: "Completed", count: stats.COMPLETED ?? 0, icon: <CheckCircle2 size={16} />, color: "text-success" },
          { label: "Failed", count: (stats.FAILED ?? 0) + (stats.DEAD ?? 0), icon: <XCircle size={16} />, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
            <div className={`flex items-center gap-2 ${s.color}`}>
              {s.icon}
              <span className="text-2xl font-bold">{s.count}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <TabsList>
            {["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD"].map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "ALL" ? "All Types" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Job Table ── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <SxDataTable
          columns={columns}
          data={data?.jobs ?? []}
          onRowClick={(job) => setSelectedJob(job)}
          emptyMessage={loading ? "Loading…" : "No jobs found"}
        />
      </div>

      {/* ── Pagination ── */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.pagination.total)} of {data.pagination.total}
          </p>
          <div className="flex gap-1">
            <SxButton size="sm" sxVariant="outline" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft size={14} />
            </SxButton>
            <SxButton size="sm" sxVariant="outline" onClick={() => setPage(page + 1)} disabled={page >= data.pagination.totalPages}>
              <ChevronRight size={14} />
            </SxButton>
          </div>
        </div>
      )}

      {/* ── Job Detail Dialog ── */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono text-xs break-all">{selectedJob.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <SxStatusBadge variant={STATUS_VARIANT[selectedJob.status] ?? "default"}>
                    {selectedJob.status}
                  </SxStatusBadge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-mono text-xs">{selectedJob.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Queue</p>
                  <p className="text-xs">{selectedJob.queue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Attempts</p>
                  <p className="text-xs">{selectedJob.attempts} / {selectedJob.maxAttempts}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-xs">{duration(selectedJob.startedAt, selectedJob.completedAt ?? selectedJob.failedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-xs">{new Date(selectedJob.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Triggered By</p>
                  <p className="text-xs">{selectedJob.user?.email ?? "system"}</p>
                </div>
              </div>

              {selectedJob.error && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                  <pre className="rounded-md bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap break-all">
                    {selectedJob.error}
                  </pre>
                </div>
              )}

              {selectedJob.result && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Result</p>
                  <pre className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
