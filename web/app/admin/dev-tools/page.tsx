"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Trash2,
  AlertTriangle,
  UserX,
  Building2,
  RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api-client";

import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxDataTable,
  type SxColumn,
} from "@/components/sx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface PendingUser {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

interface FullUser {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  emailVerified: boolean;
  platformRole: string | null;
  membershipRole: string | null;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
}

interface OrgRow {
  id: string;
  organizationName: string;
  displayName: string;
  slug: string;
  organizationCategory: string;
  organizationStructure: string;
  status: string;
  onboardingStep: string;
  createdAt: string;
  _count: { memberships: number; campuses: number; students: number };
}

interface DevToolsData {
  pending: { unverified: PendingUser[]; noOrg: PendingUser[] };
  users: FullUser[];
  organizations: OrgRow[];
}

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/* ══════════════════════════════════════════════════════════════
   Column Definitions
   ══════════════════════════════════════════════════════════════ */

function pendingColumns(onDelete: (id: number) => void, deletingId: number | null): SxColumn<PendingUser>[] {
  return [
    {
      key: "id",
      header: "ID",
      mono: true,
      render: (r) => <span className="font-data text-xs">{r.id}</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (r) => <span className="text-sm font-medium">{r.email}</span>,
    },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <span className="text-sm text-muted-foreground">{r.name || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Signed Up",
      render: (r) => (
        <span className="font-data text-xs text-muted-foreground">
          {fmtDate(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end">
          <SxButton
            sxVariant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            loading={deletingId === r.id}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(r.id);
            }}
          >
            Delete
          </SxButton>
        </div>
      ),
    },
  ];
}

const allUserColumns = (
  onDelete: (id: number) => void,
  deletingId: number | null,
): SxColumn<FullUser>[] => [
  {
    key: "id",
    header: "ID",
    mono: true,
    render: (r) => <span className="font-data text-xs">{r.id}</span>,
  },
  {
    key: "email",
    header: "Email",
    render: (r) => <span className="text-sm font-medium">{r.email}</span>,
  },
  {
    key: "platformRole",
    header: "Role",
    render: (r) => {
      if (r.platformRole) {
        return <SxStatusBadge variant="info">{humanize(r.platformRole)}</SxStatusBadge>;
      }
      if (r.membershipRole) {
        return <SxStatusBadge variant="success">{humanize(r.membershipRole)}</SxStatusBadge>;
      }
      return <span className="text-xs text-muted-foreground">—</span>;
    },
  },
  {
    key: "organizationName",
    header: "Organization",
    render: (r) => (
      <span className="text-sm text-muted-foreground">
        {r.organizationName || "—"}
      </span>
    ),
  },
  {
    key: "emailVerified",
    header: "Verified",
    render: (r) => (
      <SxStatusBadge variant={r.emailVerified ? "success" : "warning"}>
        {r.emailVerified ? "Yes" : "No"}
      </SxStatusBadge>
    ),
  },
  {
    key: "isActive",
    header: "Active",
    render: (r) => (
      <SxStatusBadge variant={r.isActive ? "success" : "muted"}>
        {r.isActive ? "Yes" : "No"}
      </SxStatusBadge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (r) => (
      <span className="font-data text-xs text-muted-foreground">
        {fmtDate(r.createdAt)}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: (r) => (
      <div className="flex justify-end">
        <SxButton
          sxVariant="danger"
          size="sm"
          icon={<Trash2 size={14} />}
          loading={deletingId === r.id}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.id);
          }}
        >
          Delete
        </SxButton>
      </div>
    ),
  },
];

const orgColumns = (
  onDelete: (id: string) => void,
  deletingId: string | null,
): SxColumn<OrgRow>[] => [
  {
    key: "id",
    header: "ID",
    mono: true,
    render: (r) => (
      <span className="font-data text-xs font-semibold text-primary">{r.id}</span>
    ),
  },
  {
    key: "organizationName",
    header: "Organization",
    render: (r) => (
      <div>
        <div className="text-sm font-medium">{r.organizationName}</div>
        <div className="text-xs text-muted-foreground">{r.slug}</div>
      </div>
    ),
  },
  {
    key: "organizationCategory",
    header: "Category",
    render: (r) => (
      <SxStatusBadge variant="info">
        {humanize(r.organizationCategory)}
      </SxStatusBadge>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <SxStatusBadge status={r.status} />,
  },
  {
    key: "_count",
    header: "Records",
    render: (r) => (
      <div className="text-xs text-muted-foreground">
        {r._count.memberships} users · {r._count.campuses} campuses · {r._count.students} students
      </div>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (r) => (
      <span className="font-data text-xs text-muted-foreground">
        {fmtDate(r.createdAt)}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    render: (r) => (
      <div className="flex justify-end">
        <SxButton
          sxVariant="danger"
          size="sm"
          icon={<Trash2 size={14} />}
          loading={deletingId === r.id}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.id);
          }}
        >
          Delete
        </SxButton>
      </div>
    ),
  },
];

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function DevToolsPage() {
  const [data, setData] = useState<DevToolsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "user" | "organization";
    id: number | string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

  /* ── Fetch ─────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await api.get<DevToolsData>("/api/dev-tools");
    if (result.ok) {
      setData(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Delete handlers ───────────────────────────────────── */

  const requestDeleteUser = (id: number) => {
    const user = data?.users.find((u) => u.id === id);
    setDeleteTarget({
      type: "user",
      id,
      label: user?.email ?? `User #${id}`,
    });
    setConfirmOpen(true);
  };

  const requestDeletePendingUser = (id: number) => {
    const pending =
      data?.pending.unverified.find((u) => u.id === id) ??
      data?.pending.noOrg.find((u) => u.id === id);
    setDeleteTarget({
      type: "user",
      id,
      label: pending?.email ?? `User #${id}`,
    });
    setConfirmOpen(true);
  };

  const requestDeleteOrg = (id: string) => {
    const org = data?.organizations.find((o) => o.id === id);
    setDeleteTarget({
      type: "organization",
      id,
      label: org ? `${org.organizationName} (${id})` : id,
    });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    if (deleteTarget.type === "user") {
      setDeletingUserId(deleteTarget.id as number);
    } else {
      setDeletingOrgId(deleteTarget.id as string);
    }

    const result = await api.delete<{ message: string }>("/api/dev-tools", {
      type: deleteTarget.type,
      id: deleteTarget.id,
    });

    if (result.ok) {
      toast.success(result.data.message);
      setConfirmOpen(false);
      setDeleteTarget(null);
      fetchData();
    } else {
      toast.error(result.error);
    }

    setDeleting(false);
    setDeletingUserId(null);
    setDeletingOrgId(null);
  };

  /* ── Counts ────────────────────────────────────────────── */

  const unverifiedCount = data?.pending.unverified.length ?? 0;
  const noOrgCount = data?.pending.noOrg.length ?? 0;
  const pendingTotal = unverifiedCount + noOrgCount;

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Dev Tools"
        subtitle="Development utilities — permanent delete operations. Use with caution."
        actions={
          <SxButton
            sxVariant="outline"
            icon={<RefreshCw size={16} />}
            onClick={fetchData}
          >
            Refresh
          </SxButton>
        }
      />

      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <AlertTriangle size={18} className="shrink-0 text-destructive" />
        <p className="text-sm text-destructive">
          All delete operations on this page are <strong>permanent and irreversible</strong>.
          Related records (memberships, invites, campuses, students, fees) are cascade-deleted.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <UserX size={14} />
            Pending Accounts
            {pendingTotal > 0 && (
              <span className="ml-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                {pendingTotal}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Building2 size={14} />
            Users & Organizations
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Pending Accounts ───────────────────────── */}
        <TabsContent value="pending" className="space-y-6 pt-4">
          {/* Unverified users */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Unverified Users ({unverifiedCount})
            </h3>
            <SxDataTable
              columns={
                pendingColumns(requestDeletePendingUser, deletingUserId) as unknown as SxColumn<Record<string, unknown>>[]
              }
              data={
                (data?.pending.unverified ?? []) as unknown as Record<string, unknown>[]
              }
              loading={loading}
              emptyMessage="No unverified users"
            />
          </div>

          {/* Users without organization */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Verified — No Organization ({noOrgCount})
            </h3>
            <SxDataTable
              columns={
                pendingColumns(requestDeletePendingUser, deletingUserId) as unknown as SxColumn<Record<string, unknown>>[]
              }
              data={
                (data?.pending.noOrg ?? []) as unknown as Record<string, unknown>[]
              }
              loading={loading}
              emptyMessage="No orphaned accounts"
            />
          </div>
        </TabsContent>

        {/* ── Tab 2: Users & Organizations ──────────────────── */}
        <TabsContent value="all" className="space-y-6 pt-4">
          {/* All users */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              All Users ({data?.users.length ?? 0})
            </h3>
            <SxDataTable
              columns={
                allUserColumns(requestDeleteUser, deletingUserId) as unknown as SxColumn<Record<string, unknown>>[]
              }
              data={
                (data?.users ?? []) as unknown as Record<string, unknown>[]
              }
              loading={loading}
              emptyMessage="No users found"
            />
          </div>

          {/* All organizations */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              All Organizations ({data?.organizations.length ?? 0})
            </h3>
            <SxDataTable
              columns={
                orgColumns(requestDeleteOrg, deletingOrgId) as unknown as SxColumn<Record<string, unknown>>[]
              }
              data={
                (data?.organizations ?? []) as unknown as Record<string, unknown>[]
              }
              loading={loading}
              emptyMessage="No organizations found"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Confirm Delete Dialog ───────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              Confirm Permanent Delete
            </DialogTitle>
            <DialogDescription>
              This action <strong>cannot be undone</strong>. All related records
              will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                {deleteTarget.type === "user" ? "User" : "Organization"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {deleteTarget.label}
              </p>
            </div>
          )}

          <DialogFooter>
            <SxButton
              type="button"
              sxVariant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </SxButton>
            <SxButton
              type="button"
              sxVariant="danger"
              icon={<Trash2 size={16} />}
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete Permanently
            </SxButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
