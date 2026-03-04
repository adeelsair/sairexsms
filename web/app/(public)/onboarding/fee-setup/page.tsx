"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { usePublicOnboardingDraft } from "@/lib/hooks/usePublicOnboardingDraft";

type FeeSetupResponse = {
  ok: boolean;
  token: string;
};

export default function FeeSetupPage() {
  const router = useRouter();
  const { draft, patchDraft } = usePublicOnboardingDraft();
  const [isSaving, setIsSaving] = useState(false);
  const [averageMonthlyFee, setAverageMonthlyFee] = useState("5000");

  useEffect(() => {
    setAverageMonthlyFee(String(draft.feeSetup?.averageMonthlyFee ?? 5000));
  }, [draft.feeSetup]);

  async function onContinue() {
    if (!draft.token) {
      toast.error("Please complete earlier steps first.");
      router.push("/onboarding/school-info");
      return;
    }

    const fee = Number(averageMonthlyFee);
    if (!Number.isFinite(fee) || fee <= 0) {
      toast.error("Please enter a valid monthly fee.");
      return;
    }

    setIsSaving(true);
    const result = await api.post<FeeSetupResponse>("/api/onboarding/fee-setup", {
      token: draft.token,
      averageMonthlyFee: fee,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    patchDraft({
      feeSetup: { averageMonthlyFee: fee },
    });
    router.push("/onboarding/admin-create");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Setup (Simple Mode)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Average Monthly Fee (PKR)</Label>
          <Input
            type="number"
            min={100}
            step={100}
            value={averageMonthlyFee}
            onChange={(e) => setAverageMonthlyFee(e.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          We&apos;ll auto-create a standard monthly tuition plan. You can fine-tune
          details later from admin settings.
        </p>

        <div className="flex gap-2">
          <SxButton sxVariant="secondary" className="w-full" onClick={() => router.back()}>
            Back
          </SxButton>
          <SxButton sxVariant="primary" className="w-full" loading={isSaving} onClick={onContinue}>
            Continue
          </SxButton>
        </div>
      </CardContent>
    </Card>
  );
}
