"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";

interface QueueSummary {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  totalOpen: number;
}

interface QueueSummaryResponse {
  queues: QueueSummary[];
  generatedAt: string;
}

function resolveQueueStatus(row: QueueSummary): "success" | "warning" | "destructive" {
  if (row.failed > 0) return "destructive";
  if (row.totalOpen > 0) return "warning";
  return "success";
}

const queueColumns: SxColumn<QueueSummary>[] = [
  {
    key: "name",
    header: "Queue",
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={resolveQueueStatus(row)}>
        {resolveQueueStatus(row) === "destructive"
          ? "Failing"
          : resolveQueueStatus(row) === "warning"
            ? "Busy"
            : "Healthy"}
      </SxStatusBadge>
    ),
  },
  { key: "waiting", header: "Waiting", numeric: true, mono: true },
  { key: "active", header: "Active", numeric: true, mono: true },
  { key: "delayed", header: "Delayed", numeric: true, mono: true },
  { key: "failed", header: "Failed", numeric: true, mono: true },
  { key: "completed", header: "Completed", numeric: true, mono: true },
  { key: "totalOpen", header: "Open", numeric: true, mono: true },
];

export default function QueuesPage() {
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueues = useCallback(async () => {
    setLoading(true);
    const result = await api.get<QueueSummaryResponse>("/api/queues");

    if (result.ok) {
      setQueues(result.data.queues);
      setGeneratedAt(result.data.generatedAt);
      setLoading(false);
      return;
    }

    toast.error(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  const openJobs = useMemo(
    () => queues.reduce((sum, queue) => sum + queue.totalOpen, 0),
    [queues],
  );

  const failedJobs = useMemo(
    () => queues.reduce((sum, queue) => sum + queue.failed, 0),
    [queues],
  );

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Queue Dashboard"
        subtitle="Real-time BullMQ backlog, active load, and failure visibility."
        actions={
          <SxButton
            sxVariant="outline"
            icon={<RefreshCw size={16} />}
            onClick={() => void loadQueues()}
            loading={loading}
          >
            Refresh
          </SxButton>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Queues</p>
          <p className="text-lg font-semibold text-foreground">{queues.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Open Jobs</p>
          <p className="text-lg font-semibold text-warning">{openJobs}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Failed Jobs</p>
          <p className="text-lg font-semibold text-destructive">{failedJobs}</p>
        </div>
      </div>

      <SxDataTable
        columns={queueColumns}
        data={queues}
        loading={loading}
        rowKey={(row) => row.name}
        emptyMessage="No queue metrics available."
      />

      <p className="text-xs text-muted-foreground">
        {generatedAt ? `Last updated: ${new Date(generatedAt).toLocaleString()}` : "Loading..."}
      </p>
    </div>
  );
}
