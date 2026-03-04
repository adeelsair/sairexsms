"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SxButton } from "./sx-button";
import { SxLimitMeter } from "./sx-limit-meter";
import { usePlanUsage } from "@/lib/billing/use-plan-limit";
import type { PlanUsagePayload } from "@/lib/billing/plan-usage.service";

interface PlanUsageCardProps {
  initialUsage?: PlanUsagePayload | null;
}

export function PlanUsageCard({ initialUsage = null }: PlanUsageCardProps) {
  const router = useRouter();
  const { usage: liveUsage, loading } = usePlanUsage({
    enabled: !initialUsage,
    initialUsage,
  });
  const usage = initialUsage ?? liveUsage;

  if (loading || !usage) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const studentLimitReached = usage.usage.students >= usage.limits.students;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Current Plan
          </p>
          <p className="text-lg font-semibold">{usage.plan}</p>
          <p className="text-xs text-muted">
            Rs {usage.pricing.monthlyPerStudentPkr.min}
            {usage.pricing.monthlyPerStudentPkr.max > usage.pricing.monthlyPerStudentPkr.min
              ? `-${usage.pricing.monthlyPerStudentPkr.max}`
              : ""}
            {" "}per student/month
          </p>
          {usage.trial.active ? (
            <p className="text-xs text-info">
              Trial active · {usage.trial.daysLeft} day{usage.trial.daysLeft === 1 ? "" : "s"} left
            </p>
          ) : null}
          {usage.upgradePath.simpleToProRecommended ? (
            <p className="text-xs text-warning">
              Upgrade suggestion: {usage.upgradePath.suggestedPlan} ({usage.upgradePath.reason})
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <SxButton sxVariant="outline" asChild>
            <Link href="/admin/students">Upgrade Plan</Link>
          </SxButton>
          <SxButton
            sxVariant="primary"
            disabled={studentLimitReached}
            onClick={() => router.push("/admin/students")}
          >
            Add Student
          </SxButton>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SxLimitMeter label="Students" used={usage.usage.students} limit={usage.limits.students} />
        <SxLimitMeter label="Campuses" used={usage.usage.campuses} limit={usage.limits.campuses} />
        <SxLimitMeter label="Staff" used={usage.usage.staff} limit={usage.limits.staff} />
      </div>
    </div>
  );
}

