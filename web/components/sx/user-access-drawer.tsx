"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  ArrowRightLeft,
  MapPin,
  ShieldOff,
  ShieldCheck,
  ScrollText,
  Shield,
  Mail,
  Clock,
  User,
  Eye,
  Building2,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Briefcase,
  Wallet,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { SxStatusBadge, SxButton, SxAmount } from "@/components/sx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

import {
  type AuditFeedResponse,
  type RbacAuditLogRaw,
  type UserAccessHistory,
  buildAccessHistory,
  getEventLabel,
  relativeTime,
} from "@/lib/mappers/rbac-audit.mapper";
import type { BadgeVariant } from "@/components/sx/sx-status-badge";
import {
  type EffectiveCampus,
  type CampusTreeNode,
  buildCampusTree,
} from "@/lib/rbac/effective-access";

/* ── Types ─────────────────────────────────────────────────── */

export interface UserAccessTarget {
  id: number;
  name: string | null;
  email: string;
}

interface UserAccessDrawerProps {
  user: UserAccessTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Constants ─────────────────────────────────────────────── */

const ACTION_ICONS: Record<string, React.ReactNode> = {
  MEMBERSHIP_INVITED: <UserPlus size={14} />,
  MEMBERSHIP_ROLE_CHANGED: <ArrowRightLeft size={14} />,
  MEMBERSHIP_SCOPE_CHANGED: <MapPin size={14} />,
  MEMBERSHIP_REVOKED: <ShieldOff size={14} />,
  MEMBERSHIP_REACTIVATED: <ShieldCheck size={14} />,
};

const ACTION_DOT_COLOR: Record<string, string> = {
  MEMBERSHIP_INVITED: "bg-info",
  MEMBERSHIP_ROLE_CHANGED: "bg-warning",
  MEMBERSHIP_SCOPE_CHANGED: "bg-primary",
  MEMBERSHIP_REVOKED: "bg-destructive",
  MEMBERSHIP_REACTIVATED: "bg-success",
};

const ACTION_BADGE_VARIANT: Record<string, BadgeVariant> = {
  MEMBERSHIP_INVITED: "info",
  MEMBERSHIP_ROLE_CHANGED: "warning",
  MEMBERSHIP_SCOPE_CHANGED: "default",
  MEMBERSHIP_REVOKED: "destructive",
  MEMBERSHIP_REACTIVATED: "success",
};

interface EffectiveAccessStats {
  students: number;
  staff: number;
  revenue: number;
}

interface EffectiveAccessResponse {
  ok: boolean;
  data: {
    campuses: EffectiveCampus[];
    totalCampuses: number;
    role: string | null;
    unitPath: string | null;
    status: string | null;
    stats?: EffectiveAccessStats;
  };
}

function humanRole(role: string | null): string {
  if (!role) return "—";
  return role.replace(/_/g, " ");
}

/* ── Tree Node Renderer ────────────────────────────────────── */

function TreeBranch({ node, depth }: { node: CampusTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0 || node.campuses.length > 0;

  return (
    <div>
      <SxButton
        sxVariant="ghost"
        size="sm"
        className="h-auto w-full justify-start gap-1.5 px-1 py-0.5 text-xs"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => setExpanded(!expanded)}
        disabled={!hasChildren}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="font-mono text-muted-foreground">{node.segment}</span>
      </SxButton>

      {expanded && (
        <>
          {node.children.map((child) => (
            <TreeBranch key={child.fullPath} node={child} depth={depth + 1} />
          ))}
          {node.campuses.map((campus) => (
            <div
              key={campus.id}
              className="flex items-center gap-1.5 py-0.5 text-xs text-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              <Building2 size={11} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{campus.name}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────── */

export function UserAccessDrawer({
  user,
  open,
  onOpenChange,
}: UserAccessDrawerProps) {
  const [history, setHistory] = useState<UserAccessHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawLogs, setRawLogs] = useState<RbacAuditLogRaw[]>([]);

  const [effectiveCount, setEffectiveCount] = useState<number | null>(null);
  const [effectiveStats, setEffectiveStats] =
    useState<EffectiveAccessStats | null>(null);
  const [effectiveCampuses, setEffectiveCampuses] = useState<
    EffectiveCampus[] | null
  >(null);
  const [effectiveExpanded, setEffectiveExpanded] = useState(false);
  const [effectiveLoading, setEffectiveLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setHistory(null);

    const result = await api.get<AuditFeedResponse>(
      `/api/audit/rbac?targetUserId=${user.id}&pageSize=100`,
    );

    if (result.ok && result.data.ok) {
      setRawLogs(result.data.data);
      setHistory(buildAccessHistory(result.data.data));
    } else {
      toast.error("Failed to load access history");
    }

    setLoading(false);
  }, [user]);

  const fetchEffectiveCount = useCallback(async () => {
    if (!user) return;

    const result = await api.get<EffectiveAccessResponse>(
      `/api/audit/effective-access?userId=${user.id}&countOnly=true&includeStats=true`,
    );

    if (result.ok && result.data.ok) {
      setEffectiveCount(result.data.data.totalCampuses);
      if (result.data.data.stats) {
        setEffectiveStats(result.data.data.stats);
      }
    }
  }, [user]);

  const fetchEffectiveCampuses = useCallback(async () => {
    if (!user) return;

    setEffectiveLoading(true);

    const result = await api.get<EffectiveAccessResponse>(
      `/api/audit/effective-access?userId=${user.id}`,
    );

    if (result.ok && result.data.ok) {
      setEffectiveCampuses(result.data.data.campuses);
      setEffectiveCount(result.data.data.totalCampuses);
    } else {
      toast.error("Failed to load effective access");
    }

    setEffectiveLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchHistory();
      fetchEffectiveCount();
    } else {
      setHistory(null);
      setRawLogs([]);
      setEffectiveCount(null);
      setEffectiveStats(null);
      setEffectiveCampuses(null);
      setEffectiveExpanded(false);
    }
  }, [open, user, fetchHistory, fetchEffectiveCount]);

  const displayName = user?.name || user?.email.split("@")[0] || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User size={18} />
            Access History
          </SheetTitle>
          <SheetDescription>
            Full role and scope timeline for this user
          </SheetDescription>
        </SheetHeader>

        {/* ── User summary ──────────────────────────────────── */}
        {user && (
          <div className="flex items-start gap-3 px-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            {history && (
              <SxStatusBadge
                variant={
                  history.currentStatus === "ACTIVE"
                    ? "success"
                    : "destructive"
                }
              >
                {history.currentStatus}
              </SxStatusBadge>
            )}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* ── Current access card ───────────────────────────── */}
        {!loading && history && (
          <div className="mx-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield size={14} />
              Current Access
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Role</span>
                <SxStatusBadge variant="info">
                  {humanRole(history.currentRole)}
                </SxStatusBadge>
              </div>
              {history.currentUnitPath && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Scope
                  </span>
                  <span className="font-mono text-xs font-medium text-foreground">
                    {history.currentUnitPath}
                  </span>
                </div>
              )}
              {history.grantedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Granted by
                  </span>
                  <span className="text-xs text-foreground">
                    {history.grantedBy}
                  </span>
                </div>
              )}
              {history.grantedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Granted
                  </span>
                  <span className="text-xs text-foreground">
                    {history.grantedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Effective Access ────────────────────────────────── */}
        {!loading && history && history.currentStatus === "ACTIVE" && (
          <div className="mx-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Eye size={14} />
                Effective Access
              </div>
              {effectiveCount !== null && (
                <SxStatusBadge variant="info">
                  {effectiveCount}{" "}
                  {effectiveCount === 1 ? "campus" : "campuses"}
                </SxStatusBadge>
              )}
            </div>

            {effectiveStats && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded border border-border bg-background p-2 text-center">
                  <GraduationCap
                    size={14}
                    className="mx-auto mb-0.5 text-muted-foreground"
                  />
                  <p className="font-data text-sm font-bold text-foreground">
                    {effectiveStats.students.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Students
                  </p>
                </div>
                <div className="rounded border border-border bg-background p-2 text-center">
                  <Briefcase
                    size={14}
                    className="mx-auto mb-0.5 text-muted-foreground"
                  />
                  <p className="font-data text-sm font-bold text-foreground">
                    {effectiveStats.staff.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Staff</p>
                </div>
                <div className="rounded border border-border bg-background p-2 text-center">
                  <Wallet
                    size={14}
                    className="mx-auto mb-0.5 text-muted-foreground"
                  />
                  <SxAmount
                    amount={effectiveStats.revenue}
                    className="text-sm font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Revenue
                  </p>
                </div>
              </div>
            )}

            {effectiveCount !== null && effectiveCount > 0 && (
              <>
                {!effectiveExpanded ? (
                  <SxButton
                    sxVariant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    icon={<Building2 size={14} />}
                    onClick={() => {
                      setEffectiveExpanded(true);
                      if (!effectiveCampuses) {
                        fetchEffectiveCampuses();
                      }
                    }}
                  >
                    View campuses
                  </SxButton>
                ) : (
                  <div className="mt-2">
                    {effectiveLoading && (
                      <div className="flex items-center justify-center py-4">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}

                    {!effectiveLoading && effectiveCampuses && (
                      <div className="max-h-48 overflow-y-auto rounded border border-border bg-background p-2">
                        {buildCampusTree(effectiveCampuses).map((node) => (
                          <TreeBranch
                            key={node.fullPath}
                            node={node}
                            depth={0}
                          />
                        ))}
                      </div>
                    )}

                    <SxButton
                      sxVariant="ghost"
                      size="sm"
                      className="mt-1 w-full text-xs"
                      onClick={() => setEffectiveExpanded(false)}
                    >
                      Collapse
                    </SxButton>
                  </div>
                )}
              </>
            )}

            {effectiveCount === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                No campuses in current scope
              </p>
            )}
          </div>
        )}

        {/* ── Timeline ──────────────────────────────────────── */}
        {!loading && history && history.events.length > 0 && (
          <div className="px-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock size={14} />
              Timeline
            </div>

            <div className="relative ml-3 border-l border-border pl-6">
              {rawLogs
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                )
                .map((log) => {
                  const dotColor =
                    ACTION_DOT_COLOR[log.action] ?? "bg-muted-foreground";
                  const variant =
                    ACTION_BADGE_VARIANT[log.action] ?? "default";
                  const icon =
                    ACTION_ICONS[log.action] ?? <ScrollText size={14} />;
                  const label = getEventLabel(log);
                  const actor =
                    log.actor.name || log.actor.email.split("@")[0];
                  const date = new Date(log.createdAt);

                  return (
                    <div key={log.id} className="relative mb-5 last:mb-0">
                      {/* Dot */}
                      <div
                        className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background ${dotColor}`}
                      />

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground">
                            {icon}
                          </span>
                          <SxStatusBadge variant={variant}>
                            {label}
                          </SxStatusBadge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          by{" "}
                          <span className="font-medium text-foreground">
                            {actor}
                          </span>
                          {" — "}
                          {relativeTime(date)}
                        </p>

                        {log.oldRole &&
                          log.newRole &&
                          log.oldRole !== log.newRole && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {humanRole(log.oldRole)} →{" "}
                              {humanRole(log.newRole)}
                            </p>
                          )}

                        {log.oldUnitPath &&
                          log.newUnitPath &&
                          log.oldUnitPath !== log.newUnitPath && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {log.oldUnitPath} → {log.newUnitPath}
                            </p>
                          )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!loading && history && history.events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ScrollText
              size={32}
              className="mb-2 text-muted-foreground/40"
            />
            <p className="text-sm text-muted-foreground">
              No access history found
            </p>
          </div>
        )}

        {/* ── Metadata footer ───────────────────────────────── */}
        {!loading && rawLogs.length > 0 && (
          <div className="mx-4 mt-auto rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail size={12} />
              <span>{rawLogs.length} events tracked</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
