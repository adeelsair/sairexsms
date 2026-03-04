"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";
import { Input } from "@/components/ui/input";
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
}

interface ClassWithSections extends Record<string, unknown> {
  id: string;
  name: string;
  campusId: number;
  sections: Section[];
}

interface AttendanceSheetRow extends Record<string, unknown> {
  enrollmentId: string;
  studentId: number;
  studentName: string;
  rollNumber: string | null;
  status: "PRESENT" | "ABSENT" | "LEAVE" | "LATE" | "HALF_DAY" | "UNMARKED";
}

type MarkStatus = "PRESENT" | "ABSENT" | "LEAVE";

interface AttendanceRecord extends Record<string, unknown> {
  enrollmentId: string;
  studentId: number;
  studentName: string;
  rollNumber: string | null;
  status: MarkStatus;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateKeyUTC(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKeyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeStatus(status: AttendanceSheetRow["status"]): MarkStatus {
  if (status === "ABSENT" || status === "LEAVE" || status === "PRESENT") {
    return status;
  }
  return "PRESENT";
}

function statusButtonClass(isActive: boolean, status: MarkStatus): string {
  if (!isActive) {
    return "h-8 border-border bg-surface px-3 text-foreground hover:bg-muted/40";
  }

  if (status === "PRESENT") {
    return "h-8 border-transparent bg-[var(--sx-success)] px-3 text-white hover:opacity-90";
  }
  if (status === "ABSENT") {
    return "h-8 border-transparent bg-[var(--sx-danger)] px-3 text-white hover:opacity-90";
  }
  return "h-8 border-transparent bg-[var(--sx-warning)] px-3 text-white hover:opacity-90";
}

export default function AttendancePage() {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [classes, setClasses] = useState<ClassWithSections[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKeyLocal());

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const sections = useMemo(() => selectedClass?.sections ?? [], [selectedClass]);

  const yearStart = activeYear ? toDateKeyUTC(activeYear.startDate) : "";
  const yearEnd = activeYear ? toDateKeyUTC(activeYear.endDate) : "";
  const dateInYear = !!activeYear && selectedDate >= yearStart && selectedDate <= yearEnd;

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    for (const record of records) {
      if (record.status === "PRESENT") present++;
      if (record.status === "ABSENT") absent++;
      if (record.status === "LEAVE") leave++;
    }
    return { total: records.length, present, absent, leave };
  }, [records]);

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

  const fetchSheet = useCallback(async () => {
    if (!selectedSectionId || !dateInYear) {
      setRecords([]);
      return;
    }

    setLoadingSheet(true);
    const query = new URLSearchParams({
      view: "section",
      sectionId: selectedSectionId,
      date: selectedDate,
    });

    const result = await api.get<ApiEnvelope<AttendanceSheetRow[]>>(
      `/api/academic/attendance?${query.toString()}`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setLoadingSheet(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load attendance sheet");
      setLoadingSheet(false);
      return;
    }

    setRecords(
      result.data.data.map((row) => ({
        enrollmentId: row.enrollmentId,
        studentId: row.studentId,
        studentName: row.studentName,
        rollNumber: row.rollNumber,
        status: normalizeStatus(row.status),
      })),
    );
    setLoadingSheet(false);
  }, [selectedSectionId, selectedDate, dateInYear]);

  useEffect(() => {
    (async () => {
      setLoadingBoot(true);
      const year = await fetchActiveYear();
      setActiveYear(year);
      if (!year) {
        setClasses([]);
        setLoadingBoot(false);
        return;
      }
      const data = await fetchClasses(year.id);
      setClasses(data);
      setLoadingBoot(false);
    })();
  }, [fetchActiveYear, fetchClasses]);

  useEffect(() => {
    setSelectedSectionId("");
    setRecords([]);
  }, [selectedClassId]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  const setRowStatus = (enrollmentId: string, status: MarkStatus) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.enrollmentId === enrollmentId
          ? { ...record, status }
          : record,
      ),
    );
  };

  const markAll = (status: MarkStatus) => {
    setRecords((prev) => prev.map((record) => ({ ...record, status })));
  };

  const saveAttendance = async () => {
    if (!activeYear || !selectedClass || !selectedSectionId) {
      toast.error("Select class and section first");
      return;
    }
    if (!dateInYear) {
      toast.error("Selected date is outside the active academic year range");
      return;
    }
    if (records.length === 0) {
      toast.error("No students available in selected section");
      return;
    }

    setSaving(true);
    const result = await api.post<ApiEnvelope<{ created: number; updated: number; total: number }>>(
      "/api/academic/attendance",
      {
        academicYearId: activeYear.id,
        campusId: selectedClass.campusId,
        classId: selectedClass.id,
        sectionId: selectedSectionId,
        date: selectedDate,
        entries: records.map((record) => ({
          enrollmentId: record.enrollmentId,
          studentId: record.studentId,
          status: record.status,
        })),
      },
    );

    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to save attendance");
      setSaving(false);
      return;
    }

    toast.success(
      `Attendance saved (${result.data.data.created} new, ${result.data.data.updated} updated)`,
    );
    await fetchSheet();
    setSaving(false);
  };

  const columns: SxColumn<AttendanceRecord>[] = useMemo(
    () => [
      {
        key: "rollNumber",
        header: "Roll",
        width: "w-24",
        mono: true,
        render: (row) => (
          <span className="font-data text-xs">{row.rollNumber ?? "-"}</span>
        ),
      },
      {
        key: "studentName",
        header: "Student Name",
        render: (row) => <span className="font-medium">{row.studentName}</span>,
      },
      {
        key: "status",
        header: "Status",
        width: "w-72",
        render: (row) => (
          <div className="flex items-center gap-2">
            <SxButton
              sxVariant="outline"
              className={statusButtonClass(row.status === "PRESENT", "PRESENT")}
              onClick={() => setRowStatus(row.enrollmentId, "PRESENT")}
            >
              Present
            </SxButton>
            <SxButton
              sxVariant="outline"
              className={statusButtonClass(row.status === "ABSENT", "ABSENT")}
              onClick={() => setRowStatus(row.enrollmentId, "ABSENT")}
            >
              Absent
            </SxButton>
            <SxButton
              sxVariant="outline"
              className={statusButtonClass(row.status === "LEAVE", "LEAVE")}
              onClick={() => setRowStatus(row.enrollmentId, "LEAVE")}
            >
              Leave
            </SxButton>
          </div>
        ),
      },
    ],
    [],
  );

  const noActiveYear = !loadingBoot && !activeYear;
  const noClasses = !!activeYear && !loadingBoot && classes.length === 0;

  return (
    <div className="space-y-6 bg-background">
      <SxPageHeader
        title="Mark Attendance"
        subtitle="Select date, class, and section to mark attendance quickly"
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
            Activate an academic year before marking attendance.
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
            Create classes and sections first to start attendance.
          </p>
          <SxButton sxVariant="primary" className="mt-3" asChild>
            <Link href="/admin/classes">Go to Classes & Sections</Link>
          </SxButton>
        </div>
      )}

      {activeYear && classes.length > 0 && (
        <>
          <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Date
              </p>
              <div className="relative">
                <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  type="date"
                  value={selectedDate}
                  min={yearStart}
                  max={yearEnd}
                  className="pl-9"
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>

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
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!dateInYear && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Selected date is outside active academic year range.
            </div>
          )}

          {selectedSectionId && dateInYear && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <SxStatusBadge variant="success">Present: {summary.present}</SxStatusBadge>
                  <SxStatusBadge variant="destructive">Absent: {summary.absent}</SxStatusBadge>
                  <SxStatusBadge variant="warning">Leave: {summary.leave}</SxStatusBadge>
                  <SxStatusBadge variant="outline">Total: {summary.total}</SxStatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <SxButton sxVariant="outline" className="h-8" onClick={() => markAll("PRESENT")}>
                    Mark All Present
                  </SxButton>
                  <SxButton sxVariant="outline" className="h-8" onClick={() => markAll("ABSENT")}>
                    Mark All Absent
                  </SxButton>
                  <SxButton sxVariant="outline" className="h-8" onClick={() => markAll("LEAVE")}>
                    Mark All Leave
                  </SxButton>
                </div>
              </div>

              <SxDataTable
                className="rounded-xl border-border bg-transparent"
                columns={columns}
                data={records}
                loading={loadingSheet}
                emptyMessage="No enrolled students found in this section."
              />

              <div className="flex justify-end">
                <SxButton
                  sxVariant="primary"
                  className="h-11 text-base font-medium"
                  loading={saving}
                  onClick={saveAttendance}
                  disabled={records.length === 0}
                >
                  Save Attendance
                </SxButton>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
