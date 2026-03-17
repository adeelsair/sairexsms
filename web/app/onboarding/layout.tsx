"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { OnboardingProvider } from "./context";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

interface OnboardingStatus {
  step: string;
  nextUrl: string;
  organizationId?: string;
  userEmail?: string;
}

const STEPS = [
  { key: "identity", label: "Identity", path: "/onboarding/identity" },
  { key: "legal", label: "Registration", path: "/onboarding/legal" },
  { key: "contact-address", label: "HO Address & Contacts", path: "/onboarding/contact-address" },
  { key: "branding", label: "Branding", path: "/onboarding/branding" },
  { key: "preview", label: "Preview", path: "/onboarding/preview" },
];

function getStepIndex(pathname: string): number {
  const idx = STEPS.findIndex((s) => s.path === pathname);
  return idx >= 0 ? idx : 0;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  const isConfirmation = pathname === "/onboarding/confirmation";

  const checkStatus = useCallback(async () => {
    const result = await api.get<OnboardingStatus>("/api/onboarding/status");
    if (result.ok) {
      if (result.data.step === "COMPLETED" && !isConfirmation) {
        router.replace("/admin/dashboard");
        return;
      }
      if (result.data.userEmail) {
        setUserEmail(result.data.userEmail);
      }
    }
    setLoading(false);
  }, [router, isConfirmation]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentStepIndex = getStepIndex(pathname);

  const progressNode = !isConfirmation ? (
    <div className="flex items-center justify-between gap-2">
      {STEPS.map((step, i) => {
        const isComplete = i < currentStepIndex;
        const isCurrent = i === currentStepIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-success opacity-90" />
            ) : (
              <Circle
                className={`h-5 w-5 ${isCurrent ? "text-white opacity-90" : "opacity-40"}`}
              />
            )}
            <span
              className={`text-sm font-medium ${isCurrent ? "opacity-100" : "opacity-80"}`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-6 sm:w-10 ${isComplete ? "bg-white/60" : "bg-white/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  ) : undefined;

  return (
    <OnboardingProvider userEmail={userEmail}>
      <OnboardingShell progressNode={progressNode} maxWidth="max-w-3xl">
        {children}
      </OnboardingShell>
    </OnboardingProvider>
  );
}
