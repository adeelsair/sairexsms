"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

const STEPS = [
  "/onboarding/school-info",
  "/onboarding/academic-setup",
  "/onboarding/fee-setup",
  "/onboarding/admin-create",
  "/onboarding/complete",
];

export default function PublicOnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const idx = Math.max(STEPS.indexOf(pathname), 0);
  const progress = Math.round(((idx + 1) / STEPS.length) * 100);

  const progressNode = (
    <div className="space-y-2">
      <p className="text-xs font-medium opacity-90">10-Minute School Setup</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white/90 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs opacity-80">
        Step {idx + 1} of {STEPS.length}
      </p>
    </div>
  );

  return (
    <OnboardingShell progressNode={progressNode} maxWidth="max-w-md">
      {children}
    </OnboardingShell>
  );
}
