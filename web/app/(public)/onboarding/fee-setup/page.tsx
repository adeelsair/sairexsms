"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Input } from "@/components/ui/input";
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

  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-semibold text-foreground">Fee Setup (Simple Mode)</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        We&apos;ll auto-create a standard monthly tuition plan. You can fine-tune details later from admin settings.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="averageMonthlyFee" className="mb-1.5 block text-sm font-medium text-foreground">
            Average Monthly Fee (PKR)
          </label>
          <Input
            id="averageMonthlyFee"
            type="number"
            min={100}
            step={100}
            value={averageMonthlyFee}
            onChange={(e) => setAverageMonthlyFee(e.target.value)}
            className={authInputClass}
          />
        </div>

        <div className="flex gap-2">
          <SxButton sxVariant="secondary" className="w-full" onClick={() => router.back()}>
            Back
          </SxButton>
          <SxButton sxVariant="primary" className="w-full" loading={isSaving} onClick={onContinue}>
            Continue
          </SxButton>
        </div>
      </div>
    </div>
  );
}
