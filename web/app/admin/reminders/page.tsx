"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

interface ReminderHistoryRow {
  id: string;
  status: "SENT" | "FAILED" | "DELIVERED" | "READ";
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  sentAt: string;
  student: {
    fullName: string;
    admissionNo: string;
  };
  challan: {
    id: number;
    challanNo: string;
    dueDate: string;
  } | null;
  reminderRule: {
    name: string;
    triggerType: "BEFORE_DUE" | "AFTER_DUE" | "PARTIAL_PAYMENT" | "FINAL_NOTICE" | "RECEIPT";
  };
}

interface ReminderHistoryResponse {
  logs: ReminderHistoryRow[];
  total: number;
  generatedAt: string;
}

function formatText(value: string): string {
  return value.replace(/_/g, " ");
}

function resolveStatusVariant(status: ReminderHistoryRow["status"]): "success" | "warning" | "destructive" | "info" {
  if (status === "FAILED") return "destructive";
  if (status === "SENT") return "warning";
  if (status === "DELIVERED") return "info";
  return "success";
}

const columns: SxColumn<ReminderHistoryRow>[] = [
  {
    key: "student",
    header: "Student",
    render: (row) => (
      <div className="space-y-0.5">
        <p className="font-medium text-foreground">{row.student.fullName}</p>
        <p className="text-xs text-muted-foreground">{row.student.admissionNo}</p>
      </div>
    ),
  },
  {
    key: "challan",
    header: "Challan",
    render: (row) => (
      <div className="space-y-0.5">
        <p className="font-medium text-foreground">
          {row.challan?.challanNo ? row.challan.challanNo : row.challan ? `#${row.challan.id}` : "N/A"}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.challan?.dueDate ? new Date(row.challan.dueDate).toLocaleDateString() : "No due date"}
        </p>
      </div>
    ),
  },
  {
    key: "trigger",
    header: "Trigger",
    render: (row) => (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{row.reminderRule.name}</p>
        <SxStatusBadge variant="outline">{formatText(row.reminderRule.triggerType)}</SxStatusBadge>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={resolveStatusVariant(row.status)}>
        {formatText(row.status)}
      </SxStatusBadge>
    ),
  },
  {
    key: "sentAt",
    header: "Sent At",
    render: (row) => (
      <span className="text-sm text-foreground">
        {new Date(row.sentAt).toLocaleString()}
      </span>
    ),
  },
];

export default function AdminRemindersPage() {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-reminder-history"],
    queryFn: async (): Promise<ReminderHistoryResponse> => {
      const result = await api.get<ReminderHistoryResponse>("/api/admin/reminders");
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load reminder history");
    }
  }, [isError, error]);

  const logs = useMemo(() => data?.logs ?? [], [data?.logs]);
  const generatedAt = data?.generatedAt ?? null;

  const sentToday = useMemo(() => {
    const today = new Date();
    return logs.filter((log) => {
      const sent = new Date(log.sentAt);
      return (
        sent.getFullYear() === today.getFullYear() &&
        sent.getMonth() === today.getMonth() &&
        sent.getDate() === today.getDate() &&
        log.status !== "FAILED"
      );
    }).length;
  }, [logs]);

  const sentThisMonth = useMemo(() => {
    const today = new Date();
    return logs.filter((log) => {
      const sent = new Date(log.sentAt);
      return (
        sent.getFullYear() === today.getFullYear() &&
        sent.getMonth() === today.getMonth() &&
        log.status !== "FAILED"
      );
    }).length;
  }, [logs]);

  const failedCount = useMemo(
    () => logs.filter((log) => log.status === "FAILED").length,
    [logs],
  );

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Reminder History"
        subtitle="Tenant-scoped automated reminder activity with latest delivery outcomes."
        actions={(
          <SxButton
            sxVariant="outline"
            icon={<RefreshCw size={16} />}
            onClick={() => void refetch()}
            loading={isFetching}
          >
            Refresh
          </SxButton>
        )}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Sent Today</p>
          <p className="text-lg font-semibold text-foreground">{sentToday}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Sent This Month</p>
          <p className="text-lg font-semibold text-success">{sentThisMonth}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-lg font-semibold text-destructive">{failedCount}</p>
        </div>
      </div>

      <SxDataTable
        columns={columns}
        data={logs}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No reminder history available yet."
      />

      <p className="text-xs text-muted-foreground">
        {generatedAt ? `Last updated: ${new Date(generatedAt).toLocaleString()}` : "Loading..."}
      </p>
    </div>
  );
}
