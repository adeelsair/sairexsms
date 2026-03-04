import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ══════════════════════════════════════════════════════════════
   SxProfileHeader — Signature UI for entity profiles
   Used for: Student, Staff, Parent, Campus, Organization
   Layout: Avatar | Name + Meta row | Status badge | Actions
   ══════════════════════════════════════════════════════════════ */

interface SxProfileHeaderProps {
  /** Display name */
  name: string;
  /** Avatar image URL */
  avatarUrl?: string;
  /** Fallback initials (auto-generated from name if not provided) */
  initials?: string;
  /** Array of meta key-value pairs shown below name */
  meta?: { label: string; value: string }[];
  /** Status badge (pass an SxStatusBadge) */
  status?: React.ReactNode;
  /** Action buttons on the right */
  actions?: React.ReactNode;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function SxProfileHeader({
  name,
  avatarUrl,
  initials,
  meta,
  status,
  actions,
  className,
}: SxProfileHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:p-6",
        className,
      )}
    >
      {/* Avatar */}
      <Avatar className="h-16 w-16 shrink-0 text-lg">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
          {initials ?? getInitials(name)}
        </AvatarFallback>
      </Avatar>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {name}
          </h2>
          {status}
        </div>

        {meta && meta.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {meta.map((item) => (
              <span
                key={item.label}
                className="text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground/70">
                  {item.label}:
                </span>{" "}
                {item.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
