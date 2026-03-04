"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Search, Users } from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AcademicYear extends Record<string, unknown> {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface Section extends Record<string, unknown> {
  id: string;
  name: string;
  _count: { enrollments: number };
}

interface ClassWithSections extends Record<string, unknown> {
  id: string;
  name: string;
  campusId: number;
  sections: Section[];
}

interface UnenrolledStudent extends Record<string, unknown> {
  id: number;
  fullName: string;
  admissionNo: string;
  campusId: number;
}

interface SectionEnrollment extends Record<string, unknown> {
  id: string;
  studentId: number;
  studentName: string;
  admissionNo: string;
  status: "ACTIVE" | "WITHDRAWN" | "PROMOTED" | "TRANSFERRED" | "RETAINED" | "GRADUATED";
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

interface ListData<T> {
  rows: T[];
  total: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusVariant(status: SectionEnrollment["status"]): "success" | "warning" | "outline" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "WITHDRAWN") return "warning";
  if (status === "PROMOTED" || status === "GRADUATED") return "info";
  return "outline";
}

const enrolledColumns: SxColumn<SectionEnrollment>[] = [
  {
    key: "studentName",
    header: "Student",
    render: (row) => <span className="font-medium">{row.studentName}</span>,
  },
  {
    key: "admissionNo",
    header: "Admission No.",
    mono: true,
    render: (row) => <span className="font-data text-xs">{row.admissionNo}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={statusVariant(row.status)}>
        {row.status}
      </SxStatusBadge>
    ),
  },
];

export default function EnrollmentsPage() {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [classes, setClasses] = useState<ClassWithSections[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [availableStudents, setAvailableStudents] = useState<UnenrolledStudent[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<SectionEnrollment[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  const [availableSearch, setAvailableSearch] = useState("");
  const [enrolledSearch, setEnrolledSearch] = useState("");

  const [bootLoading, setBootLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const sections = useMemo(() => selectedClass?.sections ?? [], [selectedClass]);
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  const toggleStudentSelection = (studentId: number, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(studentId);
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  const availableColumns: SxColumn<UnenrolledStudent>[] = useMemo(
    () => [
      {
        key: "select",
        header: "",
        width: "w-10",
        render: (row) => (
          <Checkbox
            checked={selectedStudentIds.has(row.id)}
            onCheckedChange={(value) => toggleStudentSelection(row.id, Boolean(value))}
            aria-label={`Select ${row.fullName}`}
          />
        ),
      },
      {
        key: "fullName",
        header: "Student",
        render: (row) => <span className="font-medium">{row.fullName}</span>,
      },
      {
        key: "admissionNo",
        header: "Admission No.",
        mono: true,
        render: (row) => <span className="font-data text-xs">{row.admissionNo}</span>,
      },
    ],
    [selectedStudentIds],
  );

  const fetchActiveYear = useCallback(async () => {
    const result = await api.get<ApiEnvelope<AcademicYear[]>>("/api/academic/years");
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load academic years");
      return null;
    }
    return result.data.data.find((year) => year.isActive) ?? null;
  }, []);

  const fetchClasses = useCallback(async (academicYearId: string) => {
    const result = await api.get<ApiEnvelope<ClassWithSections[]>>(
      `/api/academic/classes?academicYearId=${academicYearId}`,
    );
    if (!result.ok) {
      toast.error(result.error);
      return [] as ClassWithSections[];
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load classes");
      return [] as ClassWithSections[];
    }
    return result.data.data;
  }, []);

  const fetchAvailableStudents = useCallback(async () => {
    if (!activeYear || !selectedClass || !selectedSectionId) {
      setAvailableStudents([]);
      setSelectedStudentIds(new Set());
      return;
    }

    setAvailableLoading(true);
    const params = new URLSearchParams({
      view: "unenrolled",
      academicYearId: activeYear.id,
      campusId: String(selectedClass.campusId),
      search: availableSearch,
      limit: "300",
    });

    const result = await api.get<ApiEnvelope<ListData<UnenrolledStudent>>>(
      `/api/academic/enrollments?${params.toString()}`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setAvailableLoading(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load available students");
      setAvailableLoading(false);
      return;
    }

    setAvailableStudents(result.data.data.rows);
    setSelectedStudentIds((prev) => {
      const next = new Set<number>();
      const rowIds = new Set(result.data.data.rows.map((row) => row.id));
      for (const id of prev) {
        if (rowIds.has(id)) next.add(id);
      }
      return next;
    });
    setAvailableLoading(false);
  }, [activeYear, selectedClass, selectedSectionId, availableSearch]);

  const fetchEnrolledStudents = useCallback(async () => {
    if (!activeYear || !selectedSectionId) {
      setEnrolledStudents([]);
      return;
    }

    setEnrolledLoading(true);
    const params = new URLSearchParams({
      view: "section",
      academicYearId: activeYear.id,
      sectionId: selectedSectionId,
      search: enrolledSearch,
      limit: "300",
    });

    const result = await api.get<ApiEnvelope<ListData<SectionEnrollment>>>(
      `/api/academic/enrollments?${params.toString()}`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setEnrolledLoading(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load enrolled students");
      setEnrolledLoading(false);
      return;
    }

    setEnrolledStudents(result.data.data.rows);
    setEnrolledLoading(false);
  }, [activeYear, selectedSectionId, enrolledSearch]);

  useEffect(() => {
    (async () => {
      setBootLoading(true);
      const year = await fetchActiveYear();
      setActiveYear(year);

      if (!year) {
        setClasses([]);
        setBootLoading(false);
        return;
      }

      const cls = await fetchClasses(year.id);
      setClasses(cls);
      setBootLoading(false);
    })();
  }, [fetchActiveYear, fetchClasses]);

  useEffect(() => {
    setSelectedSectionId("");
    setAvailableStudents([]);
    setEnrolledStudents([]);
    setSelectedStudentIds(new Set());
  }, [selectedClassId]);

  useEffect(() => {
    fetchAvailableStudents();
  }, [fetchAvailableStudents]);

  useEffect(() => {
    fetchEnrolledStudents();
  }, [fetchEnrolledStudents]);

  const enrollSelected = async () => {
    if (!selectedSectionId || selectedStudentIds.size === 0) return;

    setEnrolling(true);
    const result = await api.post<ApiEnvelope<{
      requested: number;
      created: number;
      alreadyEnrolled: number;
      invalidStudentIds: number[];
    }>>("/api/academic/enrollments", {
      action: "bulkEnroll",
      sectionId: selectedSectionId,
      studentIds: Array.from(selectedStudentIds),
    });

    if (!result.ok) {
      toast.error(result.error);
      setEnrolling(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Bulk enroll failed");
      setEnrolling(false);
      return;
    }

    const info = result.data.data;
    toast.success(`Enrolled ${info.created} student(s) successfully`);
    if (info.alreadyEnrolled > 0) {
      toast.info(`${info.alreadyEnrolled} already enrolled students were skipped`);
    }
    if (info.invalidStudentIds.length > 0) {
      toast.warning(`${info.invalidStudentIds.length} invalid student records were skipped`);
    }

    await Promise.all([fetchAvailableStudents(), fetchEnrolledStudents()]);
    setSelectedStudentIds(new Set());
    setEnrolling(false);
  };

  const noActiveYear = !bootLoading && !activeYear;
  const noClasses = !!activeYear && !bootLoading && classes.length === 0;

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Enrollments"
        subtitle="Select class and section, then bulk enroll students into the active year"
      />

      {activeYear && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Active Year: <span className="font-semibold">{activeYear.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(activeYear.startDate)} - {formatDate(activeYear.endDate)}
            </p>
          </div>
          <SxStatusBadge variant="success">Active</SxStatusBadge>
        </div>
      )}

      {noActiveYear && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm font-medium text-destructive">No active academic year</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Activate an academic year before enrolling students.
          </p>
          <SxButton sxVariant="primary" className="mt-3" asChild>
            <Link href="/admin/academic-years">Go to Academic Years</Link>
          </SxButton>
        </div>
      )}

      {noClasses && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-4">
          <p className="text-sm font-medium text-warning">No classes found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create classes and sections first to start enrollment.
          </p>
          <SxButton sxVariant="primary" className="mt-3" asChild>
            <Link href="/admin/classes">Go to Classes & Sections</Link>
          </SxButton>
        </div>
      )}

      {activeYear && classes.length > 0 && (
        <>
          <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Class
              </p>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Section
              </p>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}
                disabled={!selectedClassId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedClassId ? "Select section" : "Select class first"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name} ({section._count.enrollments})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedClass && !selectedSection && (
            <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
              Select a section to load available and enrolled students.
            </div>
          )}

          {selectedClass && selectedSection && (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Available Students</p>
                    <p className="text-xs text-muted">
                      Not enrolled in {activeYear.name} ({availableStudents.length})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SxButton
                      sxVariant="outline"
                      className="h-8"
                      onClick={() => setSelectedStudentIds(new Set(availableStudents.map((s) => s.id)))}
                    >
                      Select All
                    </SxButton>
                    <SxButton
                      sxVariant="outline"
                      className="h-8"
                      onClick={() => setSelectedStudentIds(new Set())}
                    >
                      Clear
                    </SxButton>
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    value={availableSearch}
                    onChange={(event) => setAvailableSearch(event.target.value)}
                    placeholder="Search by name or admission no."
                    className="pl-9"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <SxDataTable
                    columns={availableColumns}
                    data={availableStudents}
                    loading={availableLoading}
                    emptyMessage="No available students in selected campus."
                  />
                </div>
              </div>

              <div className="flex items-center justify-center">
                <SxButton
                  sxVariant="primary"
                  onClick={enrollSelected}
                  disabled={selectedStudentIds.size === 0 || enrolling}
                  loading={enrolling}
                  icon={<ArrowRight size={16} />}
                  className="min-w-44"
                >
                  Enroll Selected
                </SxButton>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div>
                  <p className="text-sm font-semibold">Enrolled Students</p>
                  <p className="text-xs text-muted">
                    {selectedSection.name} section ({enrolledStudents.length})
                  </p>
                </div>

                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    value={enrolledSearch}
                    onChange={(event) => setEnrolledSearch(event.target.value)}
                    placeholder="Search enrolled students"
                    className="pl-9"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <SxDataTable
                    columns={enrolledColumns}
                    data={enrolledStudents}
                    loading={enrolledLoading}
                    emptyMessage="No students enrolled in this section yet."
                  />
                </div>
              </div>
            </div>
          )}

          {selectedClass && selectedSection && availableStudents.length === 0 && enrolledStudents.length === 0 && !availableLoading && !enrolledLoading && (
            <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-info">
                <Users size={16} />
                No students found for this campus yet
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add students first, then come back to enroll them in this section.
              </p>
              <SxButton sxVariant="primary" className="mt-3" asChild>
                <Link href="/admin/students">Go to Students</Link>
              </SxButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
