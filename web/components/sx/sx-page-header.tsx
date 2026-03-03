import { cn } from "@/lib/utils";

interface SxPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SxPageHeader({
  title,
  subtitle,
  actions,
  children,
  className,
}: SxPageHeaderProps) {
  const headerActions = actions ?? children;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {headerActions && (
        <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
      )}
    </div>
  );
}
