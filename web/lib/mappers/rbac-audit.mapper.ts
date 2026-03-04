import type { BadgeVariant } from "@/components/sx/sx-status-badge";

/* ── Raw shape returned by GET /api/audit/rbac ─────────────── */

export interface RbacAuditLogRaw {
  id: string;
  action: string;
  oldRole: string | null;
  newRole: string | null;
  oldUnitPath: string | null;
  newUnitPath: string | null;
  createdAt: string;
  actor: { id: number; name: string | null; email: string };
  target: { id: number; name: string | null; email: string };
}

export interface AuditFeedResponse {
  ok: boolean;
  data: RbacAuditLogRaw[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/* ── Display model for the timeline UI ─────────────────────── */

export interface AuditTimelineItem {
  id: string;
  actorId: number;
  actorName: string;
  actorEmail: string;
  targetId: number;
  targetName: string;
  targetEmail: string;
  action: string;
  actionLabel: string;
  description: string;
  badgeVariant: BadgeVariant;
  createdAt: Date;
}

/* ── Constants ─────────────────────────────────────────────── */

const ACTION_CONFIG: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  MEMBERSHIP_INVITED: { label: "Invited", variant: "info" },
  MEMBERSHIP_ROLE_CHANGED: { label: "Role Changed", variant: "warning" },
  MEMBERSHIP_SCOPE_CHANGED: { label: "Scope Changed", variant: "default" },
  MEMBERSHIP_REVOKED: { label: "Revoked", variant: "destructive" },
  MEMBERSHIP_REACTIVATED: { label: "Reactivated", variant: "success" },
};

export const AUDIT_ACTION_OPTIONS = Object.entries(ACTION_CONFIG).map(
  ([value, { label }]) => ({ value, label }),
);

/* ── Mapper ────────────────────────────────────────────────── */

function displayName(user: { name: string | null; email: string }): string {
  return user.name || user.email.split("@")[0];
}

function humanRole(role: string | null): string {
  if (!role) return "—";
  return role.replace(/_/g, " ");
}

export function mapAuditItem(raw: RbacAuditLogRaw): AuditTimelineItem {
  const actor = displayName(raw.actor);
  const target = displayName(raw.target);
  const config = ACTION_CONFIG[raw.action] ?? {
    label: raw.action,
    variant: "default" as BadgeVariant,
  };

  let description: string;

  switch (raw.action) {
    case "MEMBERSHIP_INVITED":
      description = `${actor} invited ${target} as ${humanRole(raw.newRole)}`;
      if (raw.newUnitPath) description += ` (${raw.newUnitPath})`;
      break;

    case "MEMBERSHIP_ROLE_CHANGED":
      description = `${actor} changed ${target} from ${humanRole(raw.oldRole)} to ${humanRole(raw.newRole)}`;
      if (raw.oldUnitPath !== raw.newUnitPath && raw.newUnitPath) {
        description += ` — scope ${raw.oldUnitPath ?? "org"} → ${raw.newUnitPath}`;
      }
      break;

    case "MEMBERSHIP_SCOPE_CHANGED":
      description = `${actor} moved ${target} from ${raw.oldUnitPath ?? "org"} to ${raw.newUnitPath ?? "org"}`;
      break;

    case "MEMBERSHIP_REVOKED":
      description = `${actor} revoked access for ${target}`;
      if (raw.oldRole) description += ` (was ${humanRole(raw.oldRole)})`;
      break;

    case "MEMBERSHIP_REACTIVATED":
      description = `${actor} reactivated ${target} as ${humanRole(raw.newRole)}`;
      break;

    default:
      description = `${actor} performed ${raw.action} on ${target}`;
  }

  return {
    id: raw.id,
    actorId: raw.actor.id,
    actorName: actor,
    actorEmail: raw.actor.email,
    targetId: raw.target.id,
    targetName: target,
    targetEmail: raw.target.email,
    action: raw.action,
    actionLabel: config.label,
    description,
    badgeVariant: config.variant,
    createdAt: new Date(raw.createdAt),
  };
}

/* ── Date grouping helper ──────────────────────────────────── */

export function groupByDate(
  items: AuditTimelineItem[],
): { label: string; items: AuditTimelineItem[] }[] {
  const groups = new Map<string, AuditTimelineItem[]>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const item of items) {
    const d = new Date(item.createdAt);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

/* ── Relative time helper ──────────────────────────────────── */

export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ── User Access History ──────────────────────────────────── */

export interface UserAccessHistory {
  currentRole: string | null;
  currentUnitPath: string | null;
  currentStatus: "ACTIVE" | "REVOKED";
  grantedBy: string | null;
  grantedAt: Date | null;
  events: AuditTimelineItem[];
}

export function buildAccessHistory(
  logs: RbacAuditLogRaw[],
): UserAccessHistory {
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const latest = sorted[sorted.length - 1];
  const isRevoked = latest?.action === "MEMBERSHIP_REVOKED";

  const lastGrant = [...sorted]
    .reverse()
    .find((e) => e.action !== "MEMBERSHIP_REVOKED");

  return {
    currentRole: isRevoked ? latest.oldRole : (latest?.newRole ?? null),
    currentUnitPath: isRevoked
      ? latest.oldUnitPath
      : (latest?.newUnitPath ?? null),
    currentStatus: isRevoked ? "REVOKED" : "ACTIVE",
    grantedBy: lastGrant ? displayName(lastGrant.actor) : null,
    grantedAt: lastGrant ? new Date(lastGrant.createdAt) : null,
    events: sorted.map(mapAuditItem),
  };
}

export function getEventLabel(raw: RbacAuditLogRaw): string {
  switch (raw.action) {
    case "MEMBERSHIP_INVITED":
      return `Invited as ${humanRole(raw.newRole)}${raw.newUnitPath ? ` (${raw.newUnitPath})` : ""}`;
    case "MEMBERSHIP_ROLE_CHANGED":
      return `Role changed to ${humanRole(raw.newRole)}`;
    case "MEMBERSHIP_SCOPE_CHANGED":
      return `Scope moved to ${raw.newUnitPath ?? "org-wide"}`;
    case "MEMBERSHIP_REVOKED":
      return "Access revoked";
    case "MEMBERSHIP_REACTIVATED":
      return `Reactivated as ${humanRole(raw.newRole)}`;
    default:
      return raw.action.replace(/_/g, " ").toLowerCase();
  }
}
