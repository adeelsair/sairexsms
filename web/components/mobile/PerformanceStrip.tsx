"use client";

type PerformanceStripProps = {
  completed: number;
  total: number;
  name: string;
};

export function PerformanceStrip({
  completed,
  total,
  name,
}: PerformanceStripProps) {
  const safeTotal = total <= 0 ? 0 : total;
  const percent =
    safeTotal === 0 ? 100 : Math.round((completed / safeTotal) * 100);

  return (
    <div className="mb-2 rounded-2xl bg-primary p-4 text-primary-foreground shadow-md">
      <h3 className="text-sm opacity-90">Good Morning, {name} 👋</h3>
      <p className="mt-1 text-xs">
        {completed} / {safeTotal} Actions Completed
      </p>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary-foreground/30">
        <div
          className="h-full bg-primary-foreground transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-1 text-xs">{percent}% Done</p>
    </div>
  );
}
