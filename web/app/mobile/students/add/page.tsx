"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MobileActionLayout } from "@/components/mobile/mobile-action-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMobileQuickAdmissionClasses } from "@/lib/hooks/useMobileQuickAdmission";
import { useMobileAction } from "@/lib/mobile/hooks/use-mobile-action";

type QuickAdmissionSuccess = {
  studentId?: number;
  grNumber: string;
  draftId?: string;
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
      disabled={disabled || loading}
      onClick={onSubmit}
    >
      {loading ? "Saving..." : "Add Student"}
    </Button>
  );
}

function makeTempGr() {
  const token = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TEMP-${token}`;
}

export default function QuickAdmissionPage() {
  const router = useRouter();
  const { execute } = useMobileAction();
  const classesQuery = useMobileQuickAdmissionClasses();

  const classOptions = classesQuery.data ?? [];
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [successState, setSuccessState] = useState<QuickAdmissionSuccess | null>(
    null,
  );

  const isValid = useMemo(() => {
    return (
      studentName.trim().length > 0 &&
      fatherName.trim().length > 0 &&
      mobileNumber.trim().length > 0 &&
      selectedClassId.length > 0
    );
  }, [fatherName, mobileNumber, selectedClassId, studentName]);

  const handleSave = useCallback(async () => {
    if (!isValid) {
      toast.error("Fill all required fields.");
      return;
    }

    setSaving(true);
    setSuccessState(null);

    const result = await execute("ADD_STUDENT_QUICK", {
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      mobileNumber: mobileNumber.trim(),
      classId: selectedClassId,
    });

    if (!result.ok) {
      setSaving(false);
      return;
    }

    if (result.queued) {
      toast.success("Saved offline. It will sync when online.");
      setSuccessState({
        grNumber: makeTempGr(),
        queued: true,
      });
      setSaving(false);
      return;
    }

    const response = result.data?.result;
    setSuccessState({
      studentId: response?.studentId,
      grNumber: response?.grNumber ?? "GR-PENDING",
      draftId: response?.draftId,
      queued: false,
    });
    toast.success("Student added successfully.");
    setSaving(false);
  }, [
    execute,
    fatherName,
    isValid,
    mobileNumber,
    selectedClassId,
    studentName,
  ]);

  const handleAddAnother = useCallback(() => {
    setStudentName("");
    setFatherName("");
    setMobileNumber("");
    setSuccessState(null);
  }, []);

  const handleCompleteDetails = useCallback(() => {
    if (!successState?.studentId) {
      router.replace("/mobile/dashboard?refresh=1");
      return;
    }
    router.push(`/admin/students/${successState.studentId}/edit?draft=1`);
  }, [router, successState?.studentId]);

  return (
    <MobileActionLayout
      title="Quick Admission"
      footer={
        <SubmitBar onSubmit={handleSave} disabled={!isValid} loading={saving} />
      }
    >
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Class Quick Picker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {classOptions.map((item) => (
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Student Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Student Name"
              className="h-11"
            />
            <Input
              value={fatherName}
              onChange={(event) => setFatherName(event.target.value)}
              placeholder="Father Name"
              className="h-11"
            />
            <Input
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              placeholder="Mobile Number"
              type="tel"
              inputMode="numeric"
              className="h-11"
            />
          </CardContent>
        </Card>

        {successState ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Student Added</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-lg font-semibold">{successState.grNumber}</p>
                {successState.queued ? (
                  <p className="text-xs text-muted-foreground">
                    Saved offline. GR will be reconciled after sync.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Draft ID: {successState.draftId}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={handleAddAnother}
                >
                  Add Another
                </Button>
                <Button
                  type="button"
                  className="h-11"
                  onClick={handleCompleteDetails}
                >
                  Complete Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileActionLayout>
  );
}
