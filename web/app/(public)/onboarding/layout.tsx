"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

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

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">10-Minute School Setup</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Step {idx + 1} of {STEPS.length}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
