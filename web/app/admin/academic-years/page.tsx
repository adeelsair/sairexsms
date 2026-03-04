"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  CalendarRange,
  Play,
  Lock,
  Archive,
  Pencil,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  academicYearSchema,
  type AcademicYearInput,
} from "@/lib/validations/academic-year";

import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxDataTable,
  SxFormSection,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  isActive: boolean;
  enrollmentCount: number;
  createdAt: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

/* ══════════════════════════════════════════════════════════════
   Status Badge Mapping
   ══════════════════════════════════════════════════════════════ */

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "outline" | "info"> = {
  DRAFT: "info",
  ACTIVE: "success",
  CLOSED: "warning",
  ARCHIVED: "outline",
};

/* ══════════════════════════════════════════════════════════════
   Column Definitions
   ══════════════════════════════════════════════════════════════ */

const columns: SxColumn<AcademicYear>[] = [
  {
    key: "name",
    header: "Academic Year",
    render: (row) => (
      <div className="flex items-center gap-2">
        <CalendarRange size={14} className="shrink-0 text-muted-foreground" />
        <span className="font-medium">{row.name}</span>
        {row.isActive && (
          <SxStatusBadge variant="success">Active</SxStatusBadge>
        )}
      </div>
    ),
  },
  {
    key: "startDate",
    header: "Duration",
    render: (row) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.startDate)} — {formatDate(row.endDate)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={STATUS_VARIANT[row.status] ?? "default"}>
        {row.status}
      </SxStatusBadge>
    ),
  },
  {
    key: "enrollmentCount",
    header: "Enrollments",
    numeric: true,
    render: (row) => (
      <span className="font-data text-sm">
        {row.enrollmentCount.toLocaleString()}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (row) => (
      <span className="font-data text-xs text-muted-foreground">
        {formatDate(row.createdAt)}
      </span>
    ),
  },
];

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

function suggestName(startDate: string): string {
  if (!startDate) return "";
  const d = new Date(startDate);
  const y = d.getFullYear();
  return `${y}–${y + 1}`;
}

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: "activate" | "close" | "archive";
    year: AcademicYear;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Data fetching ──────────────────────────────────────── */

  const fetchYears = useCallback(async () => {
    setLoading(true);
    const result = await api.get<ApiEnvelope<AcademicYear[]>>("/api/academic/years");
    if (result.ok && result.data.ok) {
      const data = result.data.data;
      setYears(data);
      setActiveYear(data.find((y) => y.isActive) ?? null);
    } else {
      toast.error(result.ok ? result.data.error : result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  /* ── Form: Zod resolver + React Hook Form ───────────────── */

  const form = useForm<AcademicYearInput>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: {
      name: "",
      startDate: "" as unknown as Date,
      endDate: "" as unknown as Date,
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = form;

  const watchedStart = watch("startDate");

  /* ── Auto-suggest name from start date ──────────────────── */

  useEffect(() => {
    if (watchedStart && !editingYear) {
      const suggested = suggestName(String(watchedStart));
      const currentName = form.getValues("name");
      if (!currentName || currentName === suggestName("")) {
        setValue("name", suggested);
      }
    }
  }, [watchedStart, editingYear, setValue, form]);

  /* ── Submit handler (create + edit) ─────────────────────── */

  const onSubmit = async (data: AcademicYearInput) => {
    if (editingYear) {
      const result = await api.post<ApiEnvelope<AcademicYear>>("/api/academic/years", {
        action: "update",
        yearId: editingYear.id,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      if (result.ok && result.data.ok) {
        toast.success(`Academic year "${result.data.data.name}" updated`);
        handleFormClose();
        fetchYears();
      } else {
        const error = result.ok ? result.data.error : result.error;
        toast.error(error ?? "Update failed");
      }
    } else {
      const result = await api.post<ApiEnvelope<AcademicYear>>("/api/academic/years", {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      if (result.ok && result.data.ok) {
        toast.success(`Academic year "${result.data.data.name}" created as DRAFT`);
        handleFormClose();
        fetchYears();
      } else if (result.ok && !result.data.ok) {
        toast.error(result.data.error ?? "Creation failed");
      } else if (!result.ok && result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof AcademicYearInput, {
            message: messages[0],
          });
        }
        toast.error("Please fix the validation errors");
      } else {
        toast.error(result.ok ? (result.data.error ?? "Creation failed") : (result.error ?? "Creation failed"));
      }
    }
  };

  /* ── Dialog open/close ──────────────────────────────────── */

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingYear(null);
    reset({ name: "", startDate: "" as unknown as Date, endDate: "" as unknown as Date });
  };

  const handleEdit = (year: AcademicYear) => {
    setEditingYear(year);
    reset({
      name: year.name,
      startDate: toInputDate(year.startDate) as unknown as Date,
      endDate: toInputDate(year.endDate) as unknown as Date,
    });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingYear(null);
    reset({ name: "", startDate: "" as unknown as Date, endDate: "" as unknown as Date });
    setIsFormOpen(true);
  };

  /* ── Lifecycle actions ──────────────────────────────────── */

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);

    const { type, year } = confirmAction;
    const result = await api.post<ApiEnvelope<AcademicYear>>("/api/academic/years", {
      action: type,
      yearId: year.id,
    });

    if (result.ok && result.data.ok) {
      const labels = {
        activate: "activated",
        close: "closed",
        archive: "archived",
      };
      toast.success(`Academic year "${year.name}" ${labels[type]}`);
      setConfirmAction(null);
      fetchYears();
    } else {
      toast.error(result.ok ? (result.data.error ?? "Action failed") : (result.error ?? "Action failed"));
    }
    setActionLoading(false);
  };

  /* ── Columns with actions ───────────────────────────────── */

  const columnsWithActions: SxColumn<AcademicYear>[] = [
    ...columns,
    {
      key: "actions",
      header: "",
      width: "w-12",
      render: (row) => <RowActions row={row} />,
    },
  ];

  function RowActions({ row }: { row: AcademicYear }) {
    if (row.status === "ARCHIVED") return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SxButton sxVariant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal size={16} />
          </SxButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.status === "DRAFT" && (
            <>
              <DropdownMenuItem onClick={() => handleEdit(row)}>
                <Pencil size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmAction({ type: "activate", year: row })}
              >
                <Play size={14} className="mr-2" />
                Activate
              </DropdownMenuItem>
            </>
          )}
          {row.status === "ACTIVE" && (
            <DropdownMenuItem
              onClick={() => setConfirmAction({ type: "close", year: row })}
            >
              <Lock size={14} className="mr-2" />
              Close Year
            </DropdownMenuItem>
          )}
          {row.status === "CLOSED" && (
            <DropdownMenuItem
              onClick={() => setConfirmAction({ type: "archive", year: row })}
            >
              <Archive size={14} className="mr-2" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  const confirmMessages: Record<string, { title: string; description: string }> = {
    activate: {
      title: "Activate Academic Year",
      description:
        "Activating this academic year will automatically deactivate the currently active year. All academic operations will shift to this year. Continue?",
    },
    close: {
      title: "Close Academic Year",
      description:
        "Closing an academic year locks all academic operations — attendance, exams, and enrollment. This action cannot be undone.",
    },
    archive: {
      title: "Archive Academic Year",
      description:
        "Archiving permanently locks this academic year. It will remain visible for historical reference only.",
    },
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────── */}
      <SxPageHeader
        title="Academic Years"
        subtitle="Manage academic sessions, lifecycle, and year transitions"
        actions={
          <SxButton
            sxVariant="primary"
            icon={<Plus size={16} />}
            onClick={handleCreate}
          >
            New Academic Year
          </SxButton>
        }
      />

      {/* ── Active Year Banner ─────────────────────────────── */}
      {activeYear && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Active Year: <span className="font-semibold">{activeYear.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(activeYear.startDate)} — {formatDate(activeYear.endDate)}
              {" · "}
              {activeYear.enrollmentCount.toLocaleString()} enrollments
            </p>
          </div>
          <SxStatusBadge variant="success">Active</SxStatusBadge>
        </div>
      )}

      {!activeYear && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <CalendarRange size={18} className="shrink-0 text-warning" />
          <p className="text-sm text-muted-foreground">
            No active academic year. Create and activate one to begin operations.
          </p>
        </div>
      )}

      {/* ── Data Table ────────────────────────────────────── */}
      <SxDataTable
        className="rounded-xl border-border bg-surface"
        columns={columnsWithActions as unknown as SxColumn<Record<string, unknown>>[]}
        data={years as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No academic years found. Create one to get started."
      />

      {/* ── Create / Edit Dialog ──────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingYear ? "Edit Academic Year" : "New Academic Year"}
            </DialogTitle>
            <DialogDescription>
              {editingYear
                ? "Update the details for this DRAFT academic year."
                : "Create a new academic year in DRAFT status. You can activate it later."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <SxFormSection columns={1}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic Year Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 2025–2026"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <SxFormSection columns={2}>
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? String(field.value) : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? String(field.value) : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <DialogFooter>
                <SxButton
                  type="button"
                  sxVariant="outline"
                  onClick={handleFormClose}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={isSubmitting}
                >
                  {editingYear ? "Update" : "Create"}
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialog ────────────────────────────── */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        {confirmAction && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {confirmMessages[confirmAction.type].title}
              </DialogTitle>
              <DialogDescription>
                {confirmMessages[confirmAction.type].description}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <CalendarRange size={16} className="shrink-0 text-muted" />
              <div>
                <p className="text-sm font-medium">{confirmAction.year.name}</p>
                <p className="text-xs text-muted">
                  {formatDate(confirmAction.year.startDate)} — {formatDate(confirmAction.year.endDate)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <SxButton
                type="button"
                sxVariant="outline"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </SxButton>
              <SxButton
                sxVariant={confirmAction.type === "close" ? "danger" : "primary"}
                loading={actionLoading}
                onClick={executeAction}
              >
                {confirmAction.type === "activate" && "Activate Year"}
                {confirmAction.type === "close" && "Close Year"}
                {confirmAction.type === "archive" && "Archive Year"}
              </SxButton>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
