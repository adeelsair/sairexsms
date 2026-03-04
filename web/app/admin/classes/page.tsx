"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  createClassSchema,
  createSectionSchema,
  type CreateClassInput,
  type CreateSectionInput,
} from "@/lib/validations/class-section";

import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxFormSection,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isActive: boolean;
}

interface Campus {
  id: number;
  name: string;
}

interface Section {
  id: string;
  name: string;
  capacity: number | null;
  classTeacherId: number | null;
  status: string;
  _count: { enrollments: number };
}

interface ClassWithSections {
  id: string;
  name: string;
  code: string | null;
  displayOrder: number | null;
  status: string;
  campusId: number;
  academicYearId: string;
  sections: Section[];
  _count: { enrollments: number };
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

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

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function ClassesPage() {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [classes, setClasses] = useState<ClassWithSections[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ── Dialog state ───────────────────────────────────────── */
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithSections | null>(null);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionParent, setSectionParent] = useState<ClassWithSections | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  /* ── Fetch active year ──────────────────────────────────── */

  const fetchActiveYear = useCallback(async () => {
    const result = await api.get<ApiEnvelope<AcademicYear[]>>("/api/academic/years");
    if (result.ok && result.data.ok) {
      const active = result.data.data.find((y) => y.isActive) ?? null;
      setActiveYear(active);
      return active;
    }
    return null;
  }, []);

  /* ── Fetch campuses ─────────────────────────────────────── */

  const fetchCampuses = useCallback(async () => {
    const result = await api.get<ApiEnvelope<Campus[]>>("/api/campuses?assignable=true");
    if (result.ok && result.data.ok) {
      setCampuses(result.data.data);
      return result.data.data;
    }
    return [];
  }, []);

  /* ── Fetch classes ──────────────────────────────────────── */

  const fetchClasses = useCallback(
    async (yearId: string) => {
      setLoading(true);
      const result = await api.get<ApiEnvelope<ClassWithSections[]>>(
        `/api/academic/classes?academicYearId=${yearId}`,
      );
      if (result.ok && result.data.ok) {
        setClasses(result.data.data);
      } else {
        toast.error(result.ok ? result.data.error : result.error);
      }
      setLoading(false);
    },
    [],
  );

  /* ── Initial load ───────────────────────────────────────── */

  useEffect(() => {
    (async () => {
      const [year] = await Promise.all([fetchActiveYear(), fetchCampuses()]);
      if (year) {
        await fetchClasses(year.id);
      } else {
        setLoading(false);
      }
    })();
  }, [fetchActiveYear, fetchCampuses, fetchClasses]);

  /* ── Expand / collapse ──────────────────────────────────── */

  const toggleExpand = (classId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  /* ── Refetch helper ─────────────────────────────────────── */

  const refetch = () => {
    if (activeYear) fetchClasses(activeYear.id);
  };

  /* ══════════════════════════════════════════════════════════
     Class Form
     ══════════════════════════════════════════════════════════ */

  const classForm = useForm<CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: { name: "", code: "", displayOrder: "" },
  });

  const handleOpenClassDialog = (cls?: ClassWithSections) => {
    if (cls) {
      setEditingClass(cls);
      classForm.reset({
        name: cls.name,
        code: cls.code ?? "",
        displayOrder: cls.displayOrder != null ? String(cls.displayOrder) : "",
      });
    } else {
      setEditingClass(null);
      classForm.reset({ name: "", code: "", displayOrder: "" });
    }
    setClassDialogOpen(true);
  };

  const handleCloseClassDialog = () => {
    setClassDialogOpen(false);
    setEditingClass(null);
    classForm.reset({ name: "", code: "", displayOrder: "" });
  };

  const onClassSubmit = async (data: CreateClassInput) => {
    if (!activeYear) return;
    const campus = campuses[0];
    if (!campus) {
      toast.error("No campus available. Create a campus first.");
      return;
    }

    if (editingClass) {
      const result = await api.patch<ApiEnvelope<ClassWithSections>>(
        `/api/academic/classes/${editingClass.id}`,
        {
          name: data.name,
          code: data.code || undefined,
          displayOrder: data.displayOrder ? Number(data.displayOrder) : undefined,
        },
      );
      if (result.ok && result.data.ok) {
        toast.success(`Class "${data.name}" updated`);
        handleCloseClassDialog();
        refetch();
      } else {
        toast.error(result.ok ? result.data.error : result.error);
      }
    } else {
      const result = await api.post<ApiEnvelope<ClassWithSections>>(
        "/api/academic/classes",
        {
          academicYearId: activeYear.id,
          campusId: campus.id,
          name: data.name,
          code: data.code || undefined,
          displayOrder: data.displayOrder ? Number(data.displayOrder) : undefined,
        },
      );
      if (result.ok && result.data.ok) {
        toast.success(`Class "${data.name}" created`);
        handleCloseClassDialog();
        refetch();
      } else {
        toast.error(result.ok ? result.data.error : result.error);
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     Section Form
     ══════════════════════════════════════════════════════════ */

  const sectionForm = useForm<CreateSectionInput>({
    resolver: zodResolver(createSectionSchema),
    defaultValues: { name: "", capacity: "" },
  });

  const handleOpenSectionDialog = (parent: ClassWithSections, section?: Section) => {
    setSectionParent(parent);
    if (section) {
      setEditingSection(section);
      sectionForm.reset({
        name: section.name,
        capacity: section.capacity != null ? String(section.capacity) : "",
      });
    } else {
      setEditingSection(null);
      sectionForm.reset({ name: "", capacity: "" });
    }
    setSectionDialogOpen(true);
  };

  const handleCloseSectionDialog = () => {
    setSectionDialogOpen(false);
    setSectionParent(null);
    setEditingSection(null);
    sectionForm.reset({ name: "", capacity: "" });
  };

  const onSectionSubmit = async (data: CreateSectionInput) => {
    if (!activeYear || !sectionParent) return;

    if (editingSection) {
      const result = await api.patch<ApiEnvelope<Section>>(
        `/api/academic/sections/${editingSection.id}`,
        {
          name: data.name,
          capacity: data.capacity ? Number(data.capacity) : undefined,
        },
      );
      if (result.ok && result.data.ok) {
        toast.success(`Section "${data.name}" updated`);
        handleCloseSectionDialog();
        refetch();
      } else {
        toast.error(result.ok ? result.data.error : result.error);
      }
    } else {
      const result = await api.post<ApiEnvelope<Section>>(
        "/api/academic/sections",
        {
          academicYearId: activeYear.id,
          campusId: sectionParent.campusId,
          classId: sectionParent.id,
          name: data.name,
          capacity: data.capacity ? Number(data.capacity) : undefined,
        },
      );
      if (result.ok && result.data.ok) {
        toast.success(`Section "${data.name}" added to ${sectionParent.name}`);
        handleCloseSectionDialog();
        setExpanded((prev) => new Set(prev).add(sectionParent.id));
        refetch();
      } else {
        toast.error(result.ok ? result.data.error : result.error);
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────── */}
      <SxPageHeader
        title="Classes & Sections"
        subtitle="Manage class structure and sections for the active academic year"
        actions={
          activeYear && (
            <SxButton
              sxVariant="primary"
              icon={<Plus size={16} />}
              onClick={() => handleOpenClassDialog()}
            >
              Add Class
            </SxButton>
          )
        }
      />

      {/* ── Active Year Banner ─────────────────────────────── */}
      {activeYear && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Active Year:{" "}
              <span className="font-semibold">{activeYear.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(activeYear.startDate)} —{" "}
              {formatDate(activeYear.endDate)}
            </p>
          </div>
          <SxStatusBadge variant="success">Active</SxStatusBadge>
        </div>
      )}

      {!activeYear && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle size={18} className="shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">No active academic year</p>
            <p className="text-xs text-muted-foreground">
              Go to Academic Years and activate one before managing classes.
            </p>
          </div>
        </div>
      )}

      {/* ── Class → Section Table ──────────────────────────── */}
      {activeYear && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="overflow-auto rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-10 px-3 text-xs font-semibold uppercase tracking-wider text-muted" />
                <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Name
                </TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Code
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                  Sections
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                  Enrollments
                </TableHead>
                <TableHead className="h-9 w-12 px-3 text-xs font-semibold uppercase tracking-wider text-muted" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className="px-3 py-2">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!loading && classes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted"
                  >
                    No classes found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                classes.map((cls) => {
                  const isExpanded = expanded.has(cls.id);
                  return (
                    <ClassRow
                      key={cls.id}
                      cls={cls}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(cls.id)}
                      onEdit={() => handleOpenClassDialog(cls)}
                      onAddSection={() => handleOpenSectionDialog(cls)}
                      onEditSection={(s) => handleOpenSectionDialog(cls, s)}
                    />
                  );
                })}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* ── Class Create / Edit Dialog ────────────────────── */}
      <Dialog
        open={classDialogOpen}
        onOpenChange={(open) => !open && handleCloseClassDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClass ? "Edit Class" : "Add Class"}
            </DialogTitle>
            <DialogDescription>
              {editingClass
                ? `Update "${editingClass.name}" in ${activeYear?.name}.`
                : `Create a new class in ${activeYear?.name}.`}
            </DialogDescription>
          </DialogHeader>

          <Form {...classForm}>
            <form
              onSubmit={classForm.handleSubmit(onClassSubmit)}
              className="space-y-6"
            >
              <SxFormSection columns={1}>
                <FormField
                  control={classForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Grade 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <SxFormSection columns={2}>
                <FormField
                  control={classForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. G1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={classForm.control}
                  name="displayOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 1"
                          value={
                            typeof field.value === "number"
                              ? field.value
                              : field.value === null || field.value === undefined
                                ? ""
                                : String(field.value)
                          }
                          onChange={(event) => {
                            const raw = event.target.value;
                            field.onChange(raw === "" ? undefined : Number(raw));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
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
                  onClick={handleCloseClassDialog}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={classForm.formState.isSubmitting}
                >
                  {editingClass ? "Update" : "Create"}
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Section Create / Edit Dialog ──────────────────── */}
      <Dialog
        open={sectionDialogOpen}
        onOpenChange={(open) => !open && handleCloseSectionDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? `Update section "${editingSection.name}" in ${sectionParent?.name}.`
                : `Add a new section to ${sectionParent?.name}.`}
            </DialogDescription>
          </DialogHeader>

          <Form {...sectionForm}>
            <form
              onSubmit={sectionForm.handleSubmit(onSectionSubmit)}
              className="space-y-6"
            >
              <SxFormSection columns={2}>
                <FormField
                  control={sectionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={sectionForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 40"
                          value={
                            typeof field.value === "number"
                              ? field.value
                              : field.value === null || field.value === undefined
                                ? ""
                                : String(field.value)
                          }
                          onChange={(event) => {
                            const raw = event.target.value;
                            field.onChange(raw === "" ? undefined : Number(raw));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
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
                  onClick={handleCloseSectionDialog}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={sectionForm.formState.isSubmitting}
                >
                  {editingSection ? "Update" : "Add Section"}
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Class Row (expandable with sections)
   ══════════════════════════════════════════════════════════════ */

function ClassRow({
  cls,
  isExpanded,
  onToggle,
  onEdit,
  onAddSection,
  onEditSection,
}: {
  cls: ClassWithSections;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddSection: () => void;
  onEditSection: (s: Section) => void;
}) {
  return (
    <>
      {/* ── Class row ────────────────────────────────────── */}
      <TableRow
        className="cursor-pointer transition-colors hover:bg-muted/30"
        onClick={onToggle}
      >
        <TableCell className="px-3 py-2">
          {isExpanded ? (
            <ChevronDown size={16} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Layers size={14} className="shrink-0 text-primary" />
            <span className="font-medium">{cls.name}</span>
          </div>
        </TableCell>
        <TableCell className="px-3 py-2">
          <span className="font-data text-xs text-muted-foreground">
            {cls.code || "—"}
          </span>
        </TableCell>
        <TableCell className="px-3 py-2 text-right">
          <SxStatusBadge variant="info">{cls.sections.length}</SxStatusBadge>
        </TableCell>
        <TableCell className="px-3 py-2 text-right">
          <span className="font-data text-sm">
            {cls._count.enrollments.toLocaleString()}
          </span>
        </TableCell>
        <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SxButton sxVariant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal size={16} />
              </SxButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil size={14} className="mr-2" />
                Edit Class
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddSection}>
                <Plus size={14} className="mr-2" />
                Add Section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* ── Expanded sections ─────────────────────────────── */}
      {isExpanded &&
        cls.sections.length === 0 && (
          <TableRow>
            <TableCell />
            <TableCell
              colSpan={5}
              className="py-3 pl-12 text-sm text-muted-foreground"
            >
              No sections yet.{" "}
              <SxButton
                sxVariant="ghost"
                className="h-auto p-0 text-primary underline-offset-4 hover:underline"
                onClick={onAddSection}
              >
                Add one
              </SxButton>
            </TableCell>
          </TableRow>
        )}

      {isExpanded &&
        cls.sections.map((sec) => (
          <TableRow
            key={sec.id}
            className="bg-muted/20 transition-colors hover:bg-muted/40"
          >
            <TableCell />
            <TableCell className="py-2 pl-12">
              <div className="flex items-center gap-2">
                <Users size={12} className="shrink-0 text-muted-foreground" />
                <span className="text-sm">{sec.name}</span>
              </div>
            </TableCell>
            <TableCell className="py-2">
              <span className="text-xs text-muted-foreground">
                {sec.capacity ? `Cap: ${sec.capacity}` : "—"}
              </span>
            </TableCell>
            <TableCell />
            <TableCell className="py-2 text-right">
              <span className="font-data text-xs text-muted-foreground">
                {sec._count.enrollments}
              </span>
            </TableCell>
            <TableCell className="py-2">
              <SxButton
                sxVariant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => onEditSection(sec)}
              >
                <Pencil size={14} />
              </SxButton>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
