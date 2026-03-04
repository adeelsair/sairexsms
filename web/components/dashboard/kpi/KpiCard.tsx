import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: number | string;
  icon?: ReactNode;
};

export function KpiCard({ label, value, icon }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
