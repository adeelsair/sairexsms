"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { OnboardingProvider } from "./context";

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

  return (
    <OnboardingProvider userEmail={userEmail}>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-semibold text-foreground">SAIREX SMS</h1>
            <p className="text-sm text-muted-foreground">
              {isConfirmation
                ? "Organization registered successfully"
                : "Set up your organization"}
            </p>
          </div>
        </header>

        {/* Progress stepper — hidden on confirmation page */}
        {!isConfirmation && (
          <div className="border-b border-border bg-card/50 px-6 py-4">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
              {STEPS.map((step, i) => {
                const isComplete = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;

                return (
                  <div key={step.key} className="flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle
                        className={`h-5 w-5 ${
                          isCurrent
                            ? "text-primary"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        isCurrent
                          ? "text-primary"
                          : isComplete
                            ? "text-success"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`mx-2 h-px w-8 sm:w-12 ${
                          isComplete ? "bg-success" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex flex-1 items-start justify-center px-4 py-10">
          <div className="w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </OnboardingProvider>
  );
}
