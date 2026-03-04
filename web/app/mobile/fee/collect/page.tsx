"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MobileActionLayout } from "@/components/mobile/mobile-action-layout";
import {
  StudentSearch,
  type MobileStudentSearchItem,
} from "@/components/mobile/student-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format/currency";
import { useMobileAction } from "@/lib/mobile/hooks/use-mobile-action";

type StudentDuesResponse = {
  studentId: number;
  totalDue: number;
  currentMonthDue: number;
  fine: number;
  suggestedAmount: number;
  suggestedChallanId: number | null;
};

type CollectFeeSuccess = {
  receiptNo?: string;
  posted?: boolean;
  wasDefaulterCleared?: boolean;
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
      {loading ? "Collecting..." : "Collect Fee"}
    </Button>
  );
}

export default function CollectFeePage() {
  const router = useRouter();
  const { execute } = useMobileAction();

  const [selectedStudent, setSelectedStudent] =
    useState<MobileStudentSearchItem | null>(null);
  const [dues, setDues] = useState<StudentDuesResponse | null>(null);
  const [loadingDues, setLoadingDues] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<CollectFeeSuccess | null>(null);
  const [lastAmount, setLastAmount] = useState<number>(0);

  const loadDues = useCallback(async (studentId: number) => {
    setLoadingDues(true);
    const result = await api.get<StudentDuesResponse>(
      `/api/mobile/students/${studentId}/dues`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setDues(null);
      setLoadingDues(false);
      return;
    }

    setDues(result.data);
    setAmount(String(result.data.suggestedAmount || 0));
    setLastSuccess(null);
    setLoadingDues(false);
  }, []);

  const handleSelectStudent = useCallback(
    async (student: MobileStudentSearchItem) => {
      setSelectedStudent(student);
      await loadDues(student.id);
    },
    [loadDues],
  );

  const handleCollect = useCallback(async () => {
    if (!selectedStudent) {
      toast.error("Select a student first.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    setLastSuccess(null);
    const result = await execute("COLLECT_FEE", {
      studentId: selectedStudent.id,
      amount: numericAmount,
      challanId: dues?.suggestedChallanId ?? undefined,
      reduceDefaulterCountBy: dues && numericAmount >= dues.totalDue ? 1 : 0,
    });

    if (!result.ok) {
      setSubmitting(false);
      return;
    }

    if (result.queued) {
      toast.success("Queued offline. Sync will happen automatically.");
      setAmount("");
      setLastAmount(numericAmount);
      setLastSuccess({
        posted: false,
      });
      setSubmitting(false);
      return;
    }

    toast.success("Fee collected successfully.");
    setLastAmount(numericAmount);
    setLastSuccess({
      posted: result.data?.posted,
      receiptNo: result.data?.receiptNo,
      wasDefaulterCleared: result.data?.wasDefaulterCleared,
    });
    await loadDues(selectedStudent.id);
    setSubmitting(false);
  }, [amount, dues, execute, loadDues, selectedStudent]);

  const handleCollectAnother = useCallback(() => {
    setLastSuccess(null);
    if (dues) {
      setAmount(String(dues.suggestedAmount || 0));
    } else {
      setAmount("");
    }
  }, [dues]);

  const handleBackToDashboard = useCallback(() => {
    router.replace("/mobile/dashboard?refresh=1");
  }, [router]);

  return (
    <MobileActionLayout
      title="Collect Fee"
      footer={
        <SubmitBar
          onSubmit={handleCollect}
          disabled={!selectedStudent || !dues}
          loading={submitting}
        />
      }
    >
      <div className="space-y-4">
        <StudentSearch onSelect={handleSelectStudent} />

        {selectedStudent ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Selected Student</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-medium">{selectedStudent.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {selectedStudent.admissionNo} - {selectedStudent.grade}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {loadingDues ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Loading dues...
            </CardContent>
          </Card>
        ) : null}

        {dues ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Live Dues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Due</span>
                <span className="font-semibold">{formatCurrency(dues.totalDue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Month</span>
                <span className="font-semibold">
                  {formatCurrency(dues.currentMonthDue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fine</span>
                <span className="font-semibold">{formatCurrency(dues.fine)}</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 text-2xl"
              placeholder="Enter amount"
            />
          </CardContent>
        </Card>

        {lastSuccess ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fee Collected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Success</p>
                <p className="text-xl font-bold">{formatCurrency(lastAmount)}</p>
                {lastSuccess.posted ? (
                  <p className="text-xs text-muted-foreground">
                    Posted to ledger{lastSuccess.receiptNo ? ` - ${lastSuccess.receiptNo}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Queued offline. Will post when online.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={handleCollectAnother}
                >
                  Collect Another
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
