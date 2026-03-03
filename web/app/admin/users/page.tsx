"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Copy, Lock, Unlock } from "lucide-react";

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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ── Types ─────────────────────────────────────────────────── */

interface Org {
  id: string;
  organizationName: string;
}

interface CampusRef {
  id: number;
  name: string;
  organizationId: string;
  city?: { id: string; name: string };
}

interface User {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  campusId: number | null;
  organization: { id: string; organizationName: string };
  campus: { id: number; name: string; city?: { id: string; name: string } } | null;
}

interface Invite {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  organization: { organizationName: string };
}

interface InvitesResponse {
  users: User[];
  pendingInvites: Invite[];
  organizations: Org[];
  campuses: CampusRef[];
  isSuperAdmin: boolean;
}

interface InviteFormValues {
  email: string;
  role: string;
  organizationId: string;
    campusId: string;
}

/* ── Role badge helper ─────────────────────────────────────── */

const ROLE_VARIANT: Record<string, "info" | "success" | "warning" | "default" | "muted"> = {
  SUPER_ADMIN: "info",
  ORG_ADMIN: "info",
  CAMPUS_ADMIN: "success",
  TEACHER: "warning",
  PARENT: "muted",
};

/* ── Page component ────────────────────────────────────────── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [campuses, setCampuses] = useState<CampusRef[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [filterCampusId, setFilterCampusId] = useState("");

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  /* ── Fetch data ────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await api.get<InvitesResponse>("/api/invites");
    if (result.ok) {
      setUsers(result.data.users || []);
      setInvites(result.data.pendingInvites || []);
      setOrganizations(result.data.organizations || []);
      setCampuses(result.data.campuses || []);
      setIsSuperAdmin(result.data.isSuperAdmin || false);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived filter lists ──────────────────────────────── */

  const filteredUsers = useMemo(() => {
    if (!filterCampusId) return users;
    return users.filter((u) => u.campusId === parseInt(filterCampusId));
  }, [users, filterCampusId]);

  const hasFilters = !!filterCampusId;

  /* ── Invite form ───────────────────────────────────────── */

  const form = useForm<InviteFormValues>({
    defaultValues: {
      email: "",
      role: "TEACHER",
      organizationId: "",
      campusId: "",
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = form;

  const inviteOrgId = watch("organizationId");

  const inviteCampusList = useMemo(() => {
    if (isSuperAdmin && inviteOrgId)
      return campuses.filter((c) => c.organizationId === inviteOrgId);
    return campuses;
  }, [campuses, isSuperAdmin, inviteOrgId]);

  const onInviteSubmit = async (data: InviteFormValues) => {
    const body: Record<string, string> = {
      email: data.email,
      role: data.role,
    };
    if (isSuperAdmin && data.organizationId)
      body.organizationId = data.organizationId;
    if (data.campusId) body.campusId = data.campusId;

    const result = await api.post<{ message: string; inviteUrl?: string }>(
      "/api/invites",
      body,
    );
    if (result.ok) {
      toast.success(result.data.message);
      setInviteUrl(result.data.inviteUrl || "");
      reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      reset();
      setInviteUrl("");
    }
  };

  /* ── Toggle user active ────────────────────────────────── */

  const toggleUserActive = async (user: User) => {
    setTogglingId(user.id);
    const result = await api.put<{ message: string }>("/api/invites", {
      userId: user.id,
      isActive: !user.isActive,
    });
    if (result.ok) {
      toast.success(result.data.message);
      fetchData();
    } else {
      toast.error(result.error);
    }
    setTogglingId(null);
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard");
  };

  /* ── Column definitions ────────────────────────────────── */

  const userColumns: SxColumn<User>[] = useMemo(
    () => [
      {
        key: "email",
        header: "Email",
        render: (row) => (
          <span className="text-sm font-medium">{row.email}</span>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <SxStatusBadge variant={ROLE_VARIANT[row.role] ?? "default"}>
            {row.role.replace(/_/g, " ")}
          </SxStatusBadge>
        ),
      },
      ...(isSuperAdmin
        ? [
            {
              key: "organization" as const,
              header: "Organization",
              render: (row: User) => (
                <span className="text-sm text-muted-foreground">
                  {row.organization?.organizationName}
                </span>
              ),
            },
          ]
        : []),
      {
        key: "campus",
        header: "Campus",
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.campus?.name || "—"}
          </span>
        ),
      },
      {
        key: "isActive",
        header: "Status",
        render: (row) => (
          <SxStatusBadge status={row.isActive ? "ACTIVE" : "SUSPENDED"} />
        ),
      },
      {
        key: "actions",
        header: "",
        render: (row) => (
          <div className="flex justify-end">
            <SxButton
              sxVariant={row.isActive ? "danger" : "ghost"}
              size="sm"
              icon={
                row.isActive ? <Lock size={14} /> : <Unlock size={14} />
              }
              loading={togglingId === row.id}
              onClick={(e) => {
                e.stopPropagation();
                toggleUserActive(row);
              }}
            >
              {row.isActive ? "Lock" : "Unlock"}
            </SxButton>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSuperAdmin, togglingId],
  );

  const inviteColumns: SxColumn<Invite>[] = useMemo(
    () => [
      {
        key: "email",
        header: "Email",
        render: (row) => (
          <span className="text-sm font-medium">{row.email}</span>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <SxStatusBadge variant={ROLE_VARIANT[row.role] ?? "default"}>
            {row.role.replace(/_/g, " ")}
          </SxStatusBadge>
        ),
      },
      ...(isSuperAdmin
        ? [
            {
              key: "organization" as const,
              header: "Organization",
              render: (row: Invite) => (
                <span className="text-sm text-muted-foreground">
                  {row.organization?.organizationName}
                </span>
              ),
            },
          ]
        : []),
      {
        key: "createdBy",
        header: "Invited By",
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.createdBy}
          </span>
        ),
      },
      {
        key: "expiresAt",
        header: "Expires",
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.expiresAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [isSuperAdmin],
  );

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Users & Invites"
        subtitle="Manage users and invite new team members"
        actions={
          <SxButton
            sxVariant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsDialogOpen(true)}
          >
            Invite User
          </SxButton>
        }
      />

      {/* ── Filter bar ─────────────────────────────────────── */}
      {campuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <span className="text-sm font-medium text-muted">
            Filter:
          </span>

          <Select
            value={filterCampusId || "all"}
            onValueChange={(val) =>
              setFilterCampusId(val === "all" ? "" : val)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All campuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campuses</SelectItem>
              {campuses.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <SxButton
              sxVariant="ghost"
              size="sm"
              onClick={() => setFilterCampusId("")}
            >
              Clear filters
            </SxButton>
          )}
        </div>
      )}

      {/* ── Users table ────────────────────────────────────── */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">
          Users ({filteredUsers.length}
          {hasFilters && ` of ${users.length}`})
        </h3>
        <div className="rounded-xl border border-border bg-surface p-4">
          <SxDataTable
            columns={userColumns}
            data={filteredUsers}
            rowKey={(row, index) =>
              `${row.id}-${row.email}-${row.organization?.id ?? "org"}-${row.campusId ?? "campus"}-${index}`
            }
            loading={loading}
            emptyMessage={
              hasFilters
                ? "No users match the selected filters"
                : "No users found"
            }
          />
        </div>
      </div>

      {/* ── Pending invites table ──────────────────────────── */}
      {invites.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted">
            Pending Invites ({invites.length})
          </h3>
          <div className="rounded-xl border border-border bg-surface p-4">
            <SxDataTable
              columns={inviteColumns}
              data={invites}
              emptyMessage="No pending invites"
            />
          </div>
        </div>
      )}

      {/* ── Invite dialog ──────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send an Invitation</DialogTitle>
            <DialogDescription>
              Invite a user to join your organization.
            </DialogDescription>
          </DialogHeader>

          {/* Success banner with copy link */}
          {inviteUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
              <span className="flex-1">Invite sent! Copy the link below:</span>
              <SxButton
                sxVariant="ghost"
                size="sm"
                icon={<Copy size={14} />}
                onClick={copyInviteUrl}
              >
                Copy
              </SxButton>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={handleSubmit(onInviteSubmit)}
              className="space-y-4"
            >
              {/* Org selector (SUPER_ADMIN only) */}
              {isSuperAdmin && (
                <FormField
                  control={form.control}
                  name="organizationId"
                  rules={{ required: "Organization is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("campusId", "");
                          form.setValue("campusId", "");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.organizationName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Campus */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="campusId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campus (optional)</FormLabel>
                      <Select
                        value={field.value || "all"}
                        onValueChange={(val) =>
                          field.onChange(val === "all" ? "" : val)
                        }
                        disabled={isSuperAdmin && !inviteOrgId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All campuses" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Campuses</SelectItem>
                          {inviteCampusList.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email + Role */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  rules={{ required: "Email is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="teacher@school.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  rules={{ required: "Role is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                          <SelectItem value="CAMPUS_ADMIN">
                            Campus Admin
                          </SelectItem>
                          <SelectItem value="TEACHER">Teacher</SelectItem>
                          <SelectItem value="PARENT">Parent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <SxButton
                  type="button"
                  sxVariant="outline"
                  onClick={() => handleDialogChange(false)}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={isSubmitting}
                  disabled={isSuperAdmin && !inviteOrgId}
                >
                  Send Invite
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
