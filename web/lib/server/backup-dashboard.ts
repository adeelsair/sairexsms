import type { Dirent, Stats } from "fs";
import fs from "fs/promises";
import path from "path";

/** Hours without a new archive before we warn in the admin UI */
const STALE_ARCHIVE_HOURS = 26;

/** Match infra/server/scripts/disk-alert.sh default */
const DISK_WARN_THRESHOLD_PERCENT = 80;

/** Node 18.15+ / 22 — typings may lag; keep local shape. */
type StatFsLike = {
  bsize: bigint;
  blocks: bigint;
  bfree: bigint;
  bavail: bigint;
};

async function readStatFs(checkPath: string): Promise<StatFsLike | null> {
  try {
    const fsp = await import("fs/promises");
    const statfsFn = (fsp as unknown as { statfs?: (p: string) => Promise<StatFsLike> }).statfs;
    if (typeof statfsFn !== "function") return null;
    return await statfsFn(checkPath);
  } catch {
    return null;
  }
}

/** Node may return bigint or number from `statfs` depending on platform/version. */
function statFsValueToBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return BigInt(v.trim());
  return BigInt(0);
}

function bigIntToSafeNumber(n: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max) return Number.MAX_SAFE_INTEGER;
  if (n < -max) return -Number.MAX_SAFE_INTEGER;
  return Number(n);
}

export interface DiskUsageSnapshot {
  /** Path passed to statfs (e.g. `/` or backup mount) */
  checkPath: string;
  usedPercent: number;
  totalBytes: number;
  availableBytes: number;
}

async function readDiskUsageSnapshot(): Promise<DiskUsageSnapshot | null> {
  try {
    const raw = process.env.BACKUP_DISK_STAT_PATH?.trim();
    const checkPath =
      raw && raw.length > 0 ? raw : process.platform === "win32" ? process.cwd().slice(0, 2) + "\\" : "/";
    const s = await readStatFs(checkPath);
    if (!s) return null;

    const bsize = statFsValueToBigInt((s as { bsize?: unknown }).bsize);
    const blocks = statFsValueToBigInt((s as { blocks?: unknown }).blocks);
    const bfree = statFsValueToBigInt((s as { bfree?: unknown }).bfree);
    const bavail = statFsValueToBigInt((s as { bavail?: unknown }).bavail);

    if (blocks <= BigInt(0) || bsize <= BigInt(0)) return null;

    const totalBytes = blocks * bsize;
    const availBytes = bavail * bsize;
    const usedBytes = totalBytes - bfree * bsize;
    const usedPercent = Number((BigInt(100) * usedBytes) / totalBytes);

    return {
      checkPath,
      usedPercent: Math.min(100, Math.max(0, Number.isFinite(usedPercent) ? usedPercent : 0)),
      totalBytes: bigIntToSafeNumber(totalBytes),
      availableBytes: bigIntToSafeNumber(availBytes),
    };
  } catch {
    return null;
  }
}

export interface BackupArchiveRow {
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface BackupLastRun {
  timestamp: string;
  status: string;
  error?: string | null;
  archivePath?: string | null;
  archiveFileName?: string | null;
  sizeBytes?: number;
  host?: string;
}

export interface BackupDashboardPayload {
  configured: boolean;
  message?: string;
  lastRun: BackupLastRun | null;
  archives: BackupArchiveRow[];
  /** Hours since newest archive mtime (null if none) */
  hoursSinceLatestArchive: number | null;
  /** Root (or BACKUP_DISK_STAT_PATH) filesystem usage; null if unavailable (e.g. Windows dev). */
  disk: DiskUsageSnapshot | null;
  warnings: string[];
}

export async function readBackupDashboardPayload(): Promise<BackupDashboardPayload> {
  const dirRaw = process.env.BACKUP_ARCHIVE_DIR?.trim();
  const statusFileRaw = process.env.BACKUP_STATUS_FILE?.trim();

  const disk = await readDiskUsageSnapshot();
  const diskWarnings: string[] = [];
  if (disk && disk.usedPercent >= DISK_WARN_THRESHOLD_PERCENT) {
    diskWarnings.push(
      `Disk use is ${disk.usedPercent}% on ${disk.checkPath} (threshold ${DISK_WARN_THRESHOLD_PERCENT}%).`,
    );
  }

  if (!dirRaw) {
    return {
      configured: false,
      message:
        "BACKUP_ARCHIVE_DIR is not set. Mount the host backup directory into the app container read-only and set BACKUP_ARCHIVE_DIR (see docs/backup-restore.md).",
      lastRun: null,
      archives: [],
      hoursSinceLatestArchive: null,
      disk,
      warnings: [...diskWarnings],
    };
  }

  const archiveDir = path.resolve(dirRaw);
  let st: Stats;
  try {
    st = await fs.stat(archiveDir);
  } catch {
    return {
      configured: false,
      message: `Backup path is not readable: ${archiveDir}`,
      lastRun: null,
      archives: [],
      hoursSinceLatestArchive: null,
      disk,
      warnings: [...diskWarnings],
    };
  }

  if (!st.isDirectory()) {
    return {
      configured: false,
      message: `BACKUP_ARCHIVE_DIR is not a directory: ${archiveDir}`,
      lastRun: null,
      archives: [],
      hoursSinceLatestArchive: null,
      disk,
      warnings: [...diskWarnings],
    };
  }

  const statusPath = statusFileRaw
    ? path.resolve(statusFileRaw)
    : path.join(archiveDir, "backup-last-run.json");

  const warnings: string[] = [];
  let lastRun: BackupLastRun | null = null;

  try {
    const raw = await fs.readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as BackupLastRun;
    if (parsed && typeof parsed.timestamp === "string" && typeof parsed.status === "string") {
      lastRun = parsed;
    }
  } catch {
    warnings.push("Could not read or parse backup-last-run.json");
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(archiveDir, { withFileTypes: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      lastRun,
      archives: [],
      hoursSinceLatestArchive: null,
      disk,
      warnings: [
        ...warnings,
        `Could not list backup directory (${archiveDir}): ${detail}`,
      ],
    };
  }

  const archives: BackupArchiveRow[] = [];

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.startsWith("sairex-stack-") || !ent.name.endsWith(".tar.gz")) continue;
    const fp = path.join(archiveDir, ent.name);
    try {
      const fst = await fs.stat(fp);
      archives.push({
        fileName: ent.name,
        sizeBytes: fst.size,
        modifiedAt: fst.mtime.toISOString(),
      });
    } catch {
      warnings.push(`Could not stat archive: ${ent.name}`);
    }
  }

  archives.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));

  let hoursSinceLatestArchive: number | null = null;
  if (archives.length > 0) {
    const latest = new Date(archives[0].modifiedAt).getTime();
    hoursSinceLatestArchive = (Date.now() - latest) / 3600000;
    if (hoursSinceLatestArchive > STALE_ARCHIVE_HOURS) {
      warnings.push(
        `No new stack archive in ~${STALE_ARCHIVE_HOURS}h (latest: ${archives[0].fileName}).`,
      );
    }
  } else {
    warnings.push("No sairex-stack-*.tar.gz archives found.");
  }

  if (lastRun?.status === "failed") {
    warnings.push(`Last backup run failed: ${lastRun.error ?? "unknown"}`);
  }

  for (const w of diskWarnings) {
    if (!warnings.includes(w)) warnings.push(w);
  }

  return {
    configured: true,
    lastRun,
    archives,
    hoursSinceLatestArchive,
    disk,
    warnings,
  };
}
