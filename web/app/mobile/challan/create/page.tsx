"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MobileActionLayout } from "@/components/mobile/mobile-action-layout";
import {
  StudentSearch,
  type MobileStudentSearchItem,
} from "@/components/mobile/student-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format/currency";
import { useMobileQuickAdmissionClasses } from "@/lib/hooks/useMobileQuickAdmission";
import { useMobileAction } from "@/lib/mobile/hooks/use-mobile-action";

type Mode = "single" | "class";

type StudentDuesResponse = {
  totalDue: number;
  currentMonthDue: number;
  fine: number;
  suggestedAmount: number;
};

type SuccessState = {
  mode: Mode;
  generated: number;
  skipped: number;
  totalAmount: number;
  challanIds: number[];
  label: string;
  queued: boolean;
};

function SubmitBar({
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
      onClick={onSubmit}
      disabled={disabled || loading}
    >
      {loading ? "Generating..." : "Generate Challan"}
    </Button>
  );
}

function monthOptions() {
  const now = new Date();
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [-1, 0, 1, 2].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      label: `${labels[date.getMonth()]} ${date.getFullYear()}`,
    };
  });
}

export default function IssueChallanPage() {
  const router = useRouter();
  const { execute } = useMobileAction();
  const classesQuery = useMobileQuickAdmissionClasses();

  const [mode, setMode] = useState<Mode>("single");
  const [selectedStudent, setSelectedStudent] =
    useState<MobileStudentSearchItem | null>(null);
  const [dues, setDues] = useState<StudentDuesResponse | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedMonthToken, setSelectedMonthToken] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  const months = useMemo(monthOptions, []);
  const activeMonth = useMemo(
    () => months.find((item) => `${item.month}-${item.year}` === selectedMonthToken) ?? months[1],
    [months, selectedMonthToken],
  );
  const selectedClass = useMemo(
    () => (classesQuery.data ?? []).find((item) => item.classId === selectedClassId) ?? null,
    [classesQuery.data, selectedClassId],
  );

  const handleSelectStudent = useCallback(async (student: MobileStudentSearchItem) => {
    setSelectedStudent(student);
    setSuccessState(null);
    const result = await api.get<StudentDuesResponse>(
      `/api/mobile/students/${student.id}/dues`,
    );
    if (!result.ok) {
      toast.error(result.error);
      setDues(null);
      return;
    }
    setDues(result.data);
  }, []);

  const canSubmit = mode === "single" ? !!selectedStudent : !!selectedClass;

  const handleGenerate = useCallback(async () => {
    if (!activeMonth) {
      toast.error("Select a month.");
      return;
    }
    if (!canSubmit) {
      toast.error("Select required fields first.");
      return;
    }

    setSubmitting(true);
    setSuccessState(null);

    const payload =
      mode === "single"
        ? {
            mode,
            studentId: selectedStudent?.id,
            month: activeMonth.month,
            year: activeMonth.year,
            estimatedAmount: dues?.suggestedAmount ?? 0,
            generatedEstimate: 1,
          }
        : {
            mode,
            classId: selectedClass?.classId,
            month: activeMonth.month,
            year: activeMonth.year,
            estimatedAmount: 0,
            generatedEstimate: selectedClass?.studentCount ?? 1,
          };

    const result = await execute("ISSUE_CHALLAN", payload);
    if (!result.ok) {
      setSubmitting(false);
      return;
    }

    if (result.queued) {
      toast.success("Will generate when online.");
      setSuccessState({
        mode,
        generated: 0,
        skipped: 0,
        totalAmount: 0,
        challanIds: [],
        label: mode === "single" ? selectedStudent?.fullName ?? "Student" : selectedClass?.className ?? "Class",
        queued: true,
      });
      setSubmitting(false);
      return;
    }

    const actionResult = result.data?.result;
    setSuccessState({
      mode,
      generated: actionResult?.generated ?? 0,
      skipped: actionResult?.skipped ?? 0,
      totalAmount: actionResult?.totalAmount ?? 0,
      challanIds: actionResult?.challanIds ?? [],
      label:
        mode === "single"
          ? actionResult?.studentName ?? selectedStudent?.fullName ?? "Student"
          : actionResult?.className ?? selectedClass?.className ?? "Class",
      queued: false,
    });
    toast.success("Challan generated.");
    setSubmitting(false);
  }, [
    activeMonth,
    canSubmit,
    dues?.suggestedAmount,
    execute,
    mode,
    selectedClass?.classId,
    selectedClass?.className,
    selectedStudent?.fullName,
    selectedStudent?.id,
  ]);

  const handleAnother = useCallback(() => {
    setSuccessState(null);
    setSelectedStudent(null);
    setDues(null);
    setSelectedClassId("");
  }, []);

  const handleView = useCallback(() => {
    const firstChallanId = successState?.challanIds[0];
    if (firstChallanId) {
      router.push(`/admin/finance/challans/${firstChallanId}/print`);
      return;
    }
    router.replace("/mobile/dashboard?refresh=1");
  }, [router, successState?.challanIds]);

  return (
    <MobileActionLayout
      title="Issue Challan"
      footer={<SubmitBar onSubmit={handleGenerate} disabled={!canSubmit} loading={submitting} />}
    >
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mode</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "single" ? "default" : "secondary"}
              className="h-11"
              onClick={() => setMode("single")}
            >
              Single Student
            </Button>
            <Button
              type="button"
              variant={mode === "class" ? "default" : "secondary"}
              className="h-11"
              onClick={() => setMode("class")}
            >
              Whole Class
            </Button>
          </CardContent>
        </Card>

        {mode === "single" ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Student</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StudentSearch onSelect={handleSelectStudent} />
              {selectedStudent ? (
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{selectedStudent.fullName}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.admissionNo}</p>
                </div>
              ) : null}
              {dues ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Monthly Fee</span>
                    <span>{formatCurrency(dues.currentMonthDue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Arrears</span>
                    <span>{formatCurrency(Math.max(dues.totalDue - dues.currentMonthDue, 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fine</span>
                    <span>{formatCurrency(dues.fine)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(dues.suggestedAmount)}</span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Class</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {(classesQuery.data ?? []).map((item) => (
                <Button
                  key={item.classId}
                  type="button"
                  variant={selectedClassId === item.classId ? "default" : "secondary"}
                  className="h-11"
                  onClick={() => setSelectedClassId(item.classId)}
                >
                  {item.className}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fee Month</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {months.map((item) => {
              const token = `${item.month}-${item.year}`;
              const active = (selectedMonthToken ? token === selectedMonthToken : item === activeMonth);
              return (
                <Button
                  key={token}
                  type="button"
                  variant={active ? "default" : "secondary"}
                  className="h-10"
                  onClick={() => setSelectedMonthToken(token)}
                >
                  {item.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {successState ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {successState.mode === "single" ? "Challan Issued" : "Challans Generated"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">{successState.label}</p>
                {successState.queued ? (
                  <p className="text-xs text-muted-foreground">Will generate when online.</p>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p>{successState.generated} created</p>
                    <p>{successState.skipped} already issued</p>
                    <p>{formatCurrency(successState.totalAmount)} total</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={handleAnother}
                >
                  {successState.mode === "single"
                    ? "Issue Another"
                    : "Generate For Another Class"}
                </Button>
                <Button type="button" className="h-11" onClick={handleView}>
                  {successState.mode === "single" ? "View Challan" : "Back to Dashboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileActionLayout>
  );
}
