"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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

interface Organization {
  id: string;
  organizationName: string;
}

interface Campus {
  id: number;
  name: string;
  organizationId: string;
}

interface Student {
  id: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  feeStatus: string;
  organizationId: string;
  campusId: number;
  campus: { id: number; name: string } | null;
  organization: { id: string; organizationName: string } | null;
}

interface StudentFormValues {
  fullName: string;
  admissionNo: string;
  grade: string;
  organizationId: string;
  campusId: string;
}

/* ── Column definitions ────────────────────────────────────── */

const columns: SxColumn<Student>[] = [
  {
    key: "fullName",
    header: "Name",
    render: (row) => <span className="font-medium">{row.fullName}</span>,
  },
  {
    key: "admissionNo",
    header: "Admission No.",
    mono: true,
    render: (row) => (
      <span className="font-data text-xs">{row.admissionNo}</span>
    ),
  },
  {
    key: "grade",
    header: "Grade",
  },
  {
    key: "campus",
    header: "Campus",
    render: (row) => (
      <div>
        <div>{row.campus?.name}</div>
        <div className="text-xs text-muted-foreground">
          {row.organization?.organizationName}
        </div>
      </div>
    ),
  },
  {
    key: "feeStatus",
    header: "Fee Status",
    render: (row) => <SxStatusBadge feeStatus={row.feeStatus} />,
  },
];

/* ── Page component ────────────────────────────────────────── */

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /* ── Fetch data ────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [stuResult, orgResult, camResult] = await Promise.all([
      api.get<Student[]>("/api/students"),
      api.get<Organization[]>("/api/organizations"),
      api.get<Campus[]>("/api/campuses"),
    ]);
    if (stuResult.ok) setStudents(stuResult.data);
    else toast.error(stuResult.error);
    if (orgResult.ok) setOrgs(orgResult.data);
    if (camResult.ok) setCampuses(camResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Form ──────────────────────────────────────────────── */

  const form = useForm<StudentFormValues>({
    defaultValues: {
      fullName: "",
      admissionNo: "",
      grade: "",
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

  const selectedOrgId = watch("organizationId");

  const filteredCampuses = useMemo(
    () =>
      selectedOrgId
        ? campuses.filter((c) => c.organizationId === selectedOrgId)
        : [],
    [campuses, selectedOrgId],
  );

  const onSubmit = async (data: StudentFormValues) => {
    const result = await api.post<Student>("/api/students", data);
    if (result.ok) {
      toast.success("Student admitted successfully");
      setIsDialogOpen(false);
      reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) reset();
  };

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Student Directory"
        subtitle="Manage admissions across all campuses"
        actions={
          <SxButton
            sxVariant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsDialogOpen(true)}
          >
            Admit Student
          </SxButton>
        }
      />

      <SxDataTable
        className="rounded-xl border-border bg-surface"
        columns={columns}
        data={students as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No students found. Admit a student to begin."
      />

      {/* ── Admission dialog ───────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Admission</DialogTitle>
            <DialogDescription>
              Admit a new student to a campus.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Placement section */}
              <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Placement
                </p>

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
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orgs.map((org) => (
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

                <FormField
                  control={form.control}
                  name="campusId"
                  rules={{ required: "Campus is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campus</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!selectedOrgId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                selectedOrgId
                                  ? "Select campus"
                                  : "Select org first"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredCampuses.map((c) => (
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

              {/* Student details */}
              <FormField
                control={form.control}
                name="fullName"
                rules={{ required: "Full name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Zain Sheikh" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="admissionNo"
                  rules={{ required: "Admission number is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission No.</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ISB-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="grade"
                  rules={{ required: "Grade is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade / Class</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Grade 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <SxButton
                  type="button"
                  sxVariant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={isSubmitting}
                >
                  Admit Student
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
