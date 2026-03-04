"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MobileActionLayout } from "@/components/mobile/mobile-action-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AttendanceClassQuickPick,
  type AttendanceStudentItem,
  useMobileAttendanceClasses,
  useMobileAttendanceStudents,
} from "@/lib/hooks/useMobileAttendance";
import { useMobileAction } from "@/lib/mobile/hooks/use-mobile-action";

type AttendanceSaveResult = {
  classId?: string;
  sectionId?: string;
  presentCount?: number;
  absentCount?: number;
};

function SaveBar({
  onSubmit,
  disabled,
  loading,
}: {
  onSubmit: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <Button
      type="button"
      className="h-12 w-full text-base"
      disabled={disabled || loading}
      onClick={onSubmit}
    >
      {loading ? "Saving..." : "Save Attendance"}
    </Button>
  );
}

function classKey(item: Pick<AttendanceClassQuickPick, "classId" | "sectionId">) {
  return `${item.classId}:${item.sectionId}`;
}

function todayDateToken() {
  const today = new Date();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export default function MarkAttendancePage() {
  const router = useRouter();
  const { execute } = useMobileAction();
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
  const [absentees, setAbsentees] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [successResult, setSuccessResult] = useState<AttendanceSaveResult | null>(
    null,
  );

  const classesQuery = useMobileAttendanceClasses();
  const classOptions = classesQuery.data ?? [];

  useEffect(() => {
    if (!selectedClassKey && classOptions.length > 0) {
      setSelectedClassKey(classKey(classOptions[0]));
    }
  }, [classOptions, selectedClassKey]);

  const selectedClass = useMemo(
    () => classOptions.find((item) => classKey(item) === selectedClassKey) ?? null,
    [classOptions, selectedClassKey],
  );

  const studentsQuery = useMobileAttendanceStudents(selectedClass?.sectionId ?? null);
  const students = studentsQuery.data?.students ?? [];

  useEffect(() => {
    setAbsentees(new Set());
    setSuccessResult(null);
  }, [selectedClass?.sectionId]);

  const toggleAbsent = useCallback((studentId: number) => {
    setAbsentees((previous) => {
      const next = new Set(previous);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedClass) {
      toast.error("Select a class first.");
      return;
    }

    setSaving(true);
    setSuccessResult(null);
    const result = await execute("MARK_ATTENDANCE", {
      classId: selectedClass.classId,
      sectionId: selectedClass.sectionId,
      date: todayDateToken(),
      absentees: Array.from(absentees),
    });

    if (!result.ok) {
      setSaving(false);
      return;
    }

    if (result.queued) {
      toast.success("Saved offline. It will sync automatically.");
      setSuccessResult({
        classId: selectedClass.classId,
        sectionId: selectedClass.sectionId,
        presentCount: students.length - absentees.size,
        absentCount: absentees.size,
      });
      setSaving(false);
      return;
    }

    toast.success("Attendance saved.");
    setSuccessResult(result.data?.result ?? null);
    setSaving(false);
  }, [absentees, execute, selectedClass, students.length]);

  const handleMarkAnotherClass = useCallback(() => {
    setSuccessResult(null);
    setAbsentees(new Set());
    setSelectedClassKey(null);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    router.replace("/mobile/dashboard?refresh=1");
  }, [router]);

  const isLoading = classesQuery.isLoading || studentsQuery.isLoading;

  return (
    <MobileActionLayout
      title="Mark Attendance"
      footer={
        <SaveBar
          onSubmit={handleSave}
          disabled={!selectedClass || students.length === 0}
          loading={saving}
        />
      }
    >
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Class Quick Picker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {classOptions.map((item) => {
                const active = classKey(item) === selectedClassKey;
                return (
                  <Button
                    key={classKey(item)}
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className="h-11 justify-start overflow-hidden text-ellipsis"
                    onClick={() => setSelectedClassKey(classKey(item))}
                  >
                    {item.className} - {item.sectionName}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students (Present by default)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading students...</p>
            ) : null}
            {!isLoading && students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select a class to start marking attendance.
              </p>
            ) : null}
            {students.map((student: AttendanceStudentItem) => {
              const isAbsent = absentees.has(student.studentId);
              return (
                <Button
                  key={student.enrollmentId}
                  type="button"
                  variant="ghost"
                  className={`h-auto w-full justify-start border px-3 py-3 text-left ${
                    isAbsent
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border"
                  }`}
                  onClick={() => toggleAbsent(student.studentId)}
                >
                  <div className="w-full">
                    <p className="text-sm font-medium leading-tight">
                      {student.rollNumber ? `${student.rollNumber} - ` : ""}
                      {student.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.admissionNo} - {isAbsent ? "Absent" : "Present"}
                    </p>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {successResult ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Attendance Saved</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">
                  Class {selectedClass?.className ?? "Selected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {successResult.presentCount ?? students.length - absentees.size} Present
                  {" • "}
                  {successResult.absentCount ?? absentees.size} Absent
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={handleMarkAnotherClass}
                >
                  Mark Another Class
                </Button>
                <Button
                  type="button"
                  className="h-11"
                  onClick={handleBackToDashboard}
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileActionLayout>
  );
}
