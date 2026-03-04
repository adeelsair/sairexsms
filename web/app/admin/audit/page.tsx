"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
  MapPin,
  ShieldOff,
  ShieldCheck,
  Filter,
  X,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
} from "@/components/sx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import {
  type AuditFeedResponse,
  type AuditTimelineItem,
  AUDIT_ACTION_OPTIONS,
  mapAuditItem,
  groupByDate,
  relativeTime,
} from "@/lib/mappers/rbac-audit.mapper";
import {
  UserAccessDrawer,
  type UserAccessTarget,
} from "@/components/sx/user-access-drawer";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface Filters {
  action: string;
  from: string;
  to: string;
  search: string;
}

const EMPTY_FILTERS: Filters = {
  action: "",
  from: "",
  to: "",
  search: "",
};

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

const ACTION_ICONS: Record<string, React.ReactNode> = {
  MEMBERSHIP_INVITED: <UserPlus size={16} />,
  MEMBERSHIP_ROLE_CHANGED: <ArrowRightLeft size={16} />,
  MEMBERSHIP_SCOPE_CHANGED: <MapPin size={16} />,
  MEMBERSHIP_REVOKED: <ShieldOff size={16} />,
  MEMBERSHIP_REACTIVATED: <ShieldCheck size={16} />,
};

function buildQueryString(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "20");

  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.search) params.set("search", filters.search);

  return params.toString();
}

function hasActiveFilters(f: Filters): boolean {
  return !!(f.action || f.from || f.to || f.search);
}

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function AuditPage() {
  const [items, setItems] = useState<AuditTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [drawerUser, setDrawerUser] = useState<UserAccessTarget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ── Data fetching ──────────────────────────────────────── */

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    const qs = buildQueryString(filters, page);
    const result = await api.get<AuditFeedResponse>(`/api/audit/rbac?${qs}`);

    if (result.ok) {
      const feed = result.data;
      if (feed.ok) {
        setItems(feed.data.map(mapAuditItem));
        setTotalPages(feed.meta.totalPages);
        setTotal(feed.meta.total);
      } else {
        toast.error("Failed to load audit log");
      }
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  /* ── Filter handlers ────────────────────────────────────── */

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const openUserDrawer = (item: AuditTimelineItem) => {
    setDrawerUser({
      id: item.targetId,
      name: item.targetName,
      email: item.targetEmail,
    });
    setDrawerOpen(true);
  };

  /* ── Grouped data ───────────────────────────────────────── */

  const groups = groupByDate(items);

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <SxPageHeader
        title="RBAC Audit Log"
        subtitle="Track all role changes, invitations, and access revocations"
        actions={
          <SxButton
            sxVariant={showFilters ? "primary" : "outline"}
            icon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
            {hasActiveFilters(filters) && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs font-bold text-primary">
                !
              </span>
            )}
          </SxButton>
        }
      />

      {/* ── Filters panel ───────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Action */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Action
              </label>
              <Select
                value={filters.action || "__all__"}
                onValueChange={(v) =>
                  updateFilter("action", v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All actions</SelectItem>
                  {AUDIT_ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Search user
              </label>
              <Input
                placeholder="Name or email..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
              />
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters(filters) && (
            <div className="mt-3 flex justify-end">
              <SxButton
                sxVariant="ghost"
                size="sm"
                icon={<X size={14} />}
                onClick={clearFilters}
              >
                Clear filters
              </SxButton>
            </div>
          )}
        </div>
      )}

      {/* ── Summary ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ScrollText size={16} />
        <span>
          {total} {total === 1 ? "entry" : "entries"} found
        </span>
      </div>

      {/* ── Loading state ───────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <ScrollText
            size={40}
            className="mb-3 text-muted-foreground/40"
          />
          <p className="text-sm font-medium text-muted-foreground">
            {hasActiveFilters(filters)
              ? "No audit entries match your filters"
              : "No audit activity recorded yet"}
          </p>
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Date header */}
              <div className="sticky top-0 z-10 mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Entries */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    {/* Icon */}
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {ACTION_ICONS[item.action] ?? (
                        <ScrollText size={16} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SxStatusBadge variant={item.badgeVariant}>
                          {item.actionLabel}
                        </SxStatusBadge>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {item.description}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          by{" "}
                          <span className="font-medium">
                            {item.actorEmail}
                          </span>
                        </span>
                        <span className="text-border">|</span>
                        <SxButton
                          sxVariant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs font-medium text-primary hover:underline"
                          onClick={() => openUserDrawer(item)}
                        >
                          View {item.targetName}&apos;s history
                        </SxButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <SxButton
              sxVariant="outline"
              size="sm"
              icon={<ChevronLeft size={16} />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </SxButton>
            <SxButton
              sxVariant="outline"
              size="sm"
              icon={<ChevronRight size={16} />}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </SxButton>
          </div>
        </div>
      )}

      {/* ── User Access History Drawer ────────────────────── */}
      <UserAccessDrawer
        user={drawerUser}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
