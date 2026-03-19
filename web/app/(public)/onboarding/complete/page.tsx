"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { api } from "@/lib/api-client";
import { usePublicOnboardingDraft } from "@/lib/hooks/usePublicOnboardingDraft";

type CompleteResponse = {
  ok: boolean;
  organizationId: string;
  organizationName: string;
  adminEmail: string;
  redirectTo: string;
};

export default function CompletePage() {
  const router = useRouter();
  const { draft, clearDraft } = usePublicOnboardingDraft();
  const [isFinishing, setIsFinishing] = useState(false);

  async function onGoLive() {
    if (!draft.token || !draft.adminSetup?.password) {
      toast.error("Missing setup data. Please complete previous steps.");
      router.push("/onboarding/school-info");
      return;
    }

    setIsFinishing(true);
    const result = await api.post<CompleteResponse>("/api/onboarding/wizard/complete", {
      token: draft.token,
      password: draft.adminSetup.password,
    });

    if (!result.ok) {
      setIsFinishing(false);
      toast.error(result.error);
      return;
    }

    const signInResult = await api.post<{ ok: boolean; user: { id: string } }>(
      "/api/login",
      {
        email: result.data.adminEmail,
        password: draft.adminSetup.password,
      },
    );

    if (!signInResult.ok) {
      setIsFinishing(false);
      toast.error("Setup complete. Please login manually.");
      router.push("/login");
      return;
    }

    clearDraft();
    toast.success("School setup completed successfully.");
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-semibold text-foreground">Go Live</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Finalize setup to create your school workspace, admin account, academic structure, and default monthly fee plan.
      </p>

      <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>School profile and main campus</li>
        <li>Classes and sections</li>
        <li>Standard monthly fee setup</li>
        <li>Admin account and automatic login</li>
      </ul>

      <div className="flex gap-2">
        <SxButton sxVariant="secondary" className="w-full" onClick={() => router.back()}>
          Back
        </SxButton>
        <SxButton sxVariant="primary" className="w-full" loading={isFinishing} onClick={onGoLive}>
          Go Live
        </SxButton>
      </div>
    </div>
  );
}
