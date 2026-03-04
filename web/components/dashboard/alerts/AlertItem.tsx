import Link from "next/link";
import { cn } from "@/lib/utils";

type AlertVariant = "danger" | "warning" | "info";

interface AlertItemProps {
  label: string;
  count: number;
  href: string;
  variant?: AlertVariant;
}

export function AlertItem({
  label,
  count,
  href,
  variant = "info",
}: AlertItemProps) {
  if (count === 0) return null;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-xl border p-3 text-sm font-medium transition hover:bg-accent",
        variant === "danger" && "border-destructive/40 text-destructive",
        variant === "warning" && "border-warning/40 text-warning",
        variant === "info" && "border-border text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </Link>
  );
}
