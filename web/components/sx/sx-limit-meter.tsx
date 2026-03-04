import { cn } from "@/lib/utils";

interface SxLimitMeterProps {
  used: number;
  limit: number;
  label: string;
}

export function SxLimitMeter({ used, limit, label }: SxLimitMeterProps) {
  const safeLimit = Math.max(limit, 1);
  const ratio = Math.min(used / safeLimit, 1);
  const percent = Math.round(ratio * 100);
  const reached = used >= limit;
  const critical = !reached && ratio > 0.9;
  const near = !reached && !critical && ratio >= 0.7;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-data",
            (reached || critical) && "text-destructive",
            near && "text-warning",
          )}
        >
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full transition-all",
            (reached || critical) && "bg-destructive",
            near && "bg-warning",
            !near && !critical && !reached && "bg-success",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {reached && (
        <p className="text-xs text-destructive">Limit reached</p>
      )}
    </div>
  );
}

