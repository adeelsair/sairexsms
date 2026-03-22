"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";

interface BackupArchiveRow {
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface BackupLastRun {
  timestamp: string;
  status: string;
  error?: string | null;
  archiveFileName?: string | null;
  sizeBytes?: number;
  host?: string;
}

interface DiskUsageSnapshot {
  checkPath: string;
  usedPercent: number;
  totalBytes: number;
  availableBytes: number;
}

interface BackupDashboardPayload {
  configured: boolean;
  message?: string;
  lastRun: BackupLastRun | null;
  archives: BackupArchiveRow[];
  hoursSinceLatestArchive: number | null;
  disk: DiskUsageSnapshot | null;
  warnings: string[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const archiveColumns: SxColumn<BackupArchiveRow>[] = [
  { key: "fileName", header: "Archive" },
  {
    key: "sizeBytes",
    header: "Size",
    numeric: true,
    render: (row) => formatBytes(row.sizeBytes),
  },
  { key: "modifiedAt", header: "Modified (UTC)", mono: true },
];

export default function BackupsPage() {
  const [data, setData] = useState<BackupDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api.get<BackupDashboardPayload>("/api/admin/backups");
    if (!result.ok) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lastRunVariant = useMemo(() => {
    const s = data?.lastRun?.status;
    if (s === "success") return "success" as const;
    if (s === "failed") return "destructive" as const;
    return "muted" as const;
  }, [data?.lastRun?.status]);

  const diskVariant = useMemo(() => {
    const p = data?.disk?.usedPercent;
    if (p == null) return "muted" as const;
    if (p >= 90) return "destructive" as const;
    if (p >= 80) return "warning" as const;
    return "success" as const;
  }, [data?.disk?.usedPercent]);

  if (loading && data === null) {
    return (
      <>
        <SxPageHeader
          title="Backups"
          subtitle="System · full-stack archives (backup-stack.sh). SUPER_ADMIN only."
        />
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <SxPageHeader
          title="Backups"
          subtitle="System · full-stack archives (backup-stack.sh). SUPER_ADMIN only."
          actions={
            <SxButton sxVariant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </SxButton>
          }
        />
        <p className="mt-6 text-sm text-destructive">Could not load backup dashboard.</p>
      </>
    );
  }

  return (
    <>
      <SxPageHeader
        title="Backups"
        subtitle="System · full-stack archives (backup-stack.sh). SUPER_ADMIN only."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SxButton sxVariant="outline" disabled title="Use host cron or SSH; not exposed over HTTP for safety">
              Run backup
            </SxButton>
            <SxButton sxVariant="outline" disabled title="Use restore-stack.sh on the server with confirmation env vars">
              Restore
            </SxButton>
            <SxButton sxVariant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </SxButton>
          </div>
        }
      />

      {!data.configured ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Backup visibility not configured</p>
          <p className="mt-2">{data.message ?? "Set BACKUP_ARCHIVE_DIR on the app container."}</p>
          <p className="mt-4 text-xs">
            Mount the host directory that contains <code className="text-foreground">sairex-stack-*.tar.gz</code> into
            the app container read-only, then set <code className="text-foreground">BACKUP_ARCHIVE_DIR</code> in
            server env. See <code className="text-foreground">docs/backup-restore.md</code>.
          </p>
          {data.disk ? (
            <div className="mt-6 rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disk (app container)</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <SxStatusBadge variant={diskVariant}>{data.disk.usedPercent}% used</SxStatusBadge>
                <span className="text-sm text-muted-foreground">{data.disk.checkPath}</span>
                <span className="text-sm text-muted-foreground">{formatBytes(data.disk.availableBytes)} free</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {data.disk ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disk (app container)</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <SxStatusBadge variant={diskVariant}>{data.disk.usedPercent}% used</SxStatusBadge>
                <span className="text-sm text-muted-foreground">path: {data.disk.checkPath}</span>
                <span className="text-sm text-muted-foreground">{formatBytes(data.disk.availableBytes)} available</span>
                <span className="text-sm text-muted-foreground">of {formatBytes(data.disk.totalBytes)}</span>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last run</p>
            {data.lastRun ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <SxStatusBadge variant={lastRunVariant}>{data.lastRun.status}</SxStatusBadge>
                <span className="text-sm text-muted-foreground">{data.lastRun.timestamp}</span>
                {data.lastRun.archiveFileName ? (
                  <span className="text-sm text-foreground">{data.lastRun.archiveFileName}</span>
                ) : null}
                {data.lastRun.host ? (
                  <span className="text-sm text-muted-foreground">host: {data.lastRun.host}</span>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No backup-last-run.json yet.</p>
            )}
            {data.lastRun?.error ? (
              <p className="mt-2 text-sm text-destructive">{data.lastRun.error}</p>
            ) : null}
            {data.hoursSinceLatestArchive != null ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Newest archive: {data.hoursSinceLatestArchive.toFixed(1)} hours ago
              </p>
            ) : null}
          </div>

          {data.warnings.length > 0 ? (
            <div className="rounded-xl border border-warning/25 bg-warning/15 p-4">
              <p className="text-sm font-semibold text-warning-foreground">Alerts</p>
              <ul className="mt-2 list-inside list-disc text-sm text-foreground">
                {data.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Restore stays server-side: <code className="text-foreground">restore-stack.sh</code> with explicit
              confirmation env vars. Manual backup runs use cron or SSH — not triggered from this UI.
            </p>
            <SxDataTable
              columns={archiveColumns}
              data={data.archives}
              loading={loading}
              rowKey={(row) => row.fileName}
              emptyMessage="No stack archives found."
            />
          </div>
        </div>
      )}
    </>
  );
}
