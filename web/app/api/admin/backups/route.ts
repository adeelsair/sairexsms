import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { readBackupDashboardPayload } from "@/lib/server/backup-dashboard";

/**
 * GET /api/admin/backups
 *
 * First-class System → Backups dashboard payload. SUPER_ADMIN only.
 * Reads host-mounted backup dir via BACKUP_ARCHIVE_DIR (see docs/backup-restore.md).
 *
 * Not implemented here (by design): POST run-backup / restore / download — too risky for a web request;
 * use host cron + SSH + restore-stack.sh.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const data = await readBackupDashboardPayload();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/backups] readBackupDashboardPayload failed:", err);
    return NextResponse.json({ error: "Failed to read backup dashboard data" }, { status: 500 });
  }
}
