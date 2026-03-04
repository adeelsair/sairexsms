import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

/* ── Badge variants ─────────────────────────────────────────── */
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground ring-secondary",
        success:
          "bg-success/15 text-success ring-success/25",
        destructive:
          "bg-destructive/15 text-destructive ring-destructive/25",
        warning:
          "bg-warning/15 text-warning-foreground ring-warning/25 dark:text-warning",
        info:
          "bg-info/15 text-info ring-info/25",
        outline:
          "bg-transparent text-foreground ring-border",
        muted:
          "bg-muted text-muted-foreground ring-muted",

        /* ── Fee status (fixed mapping) ───────────────────── */
        "fee-paid":
          "bg-fee-paid/15 text-fee-paid ring-fee-paid/25",
        "fee-unpaid":
          "bg-fee-unpaid/15 text-fee-unpaid ring-fee-unpaid/25",
        "fee-partial":
          "bg-fee-partial/15 text-fee-partial ring-fee-partial/25 dark:text-fee-partial",
        "fee-advance":
          "bg-fee-advance/15 text-fee-advance ring-fee-advance/25",
        "fee-refund":
          "bg-fee-refund/15 text-fee-refund ring-fee-refund/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/* ── Automatic fee status → variant mapping ─────────────────── */
const FEE_STATUS_MAP: Record<string, BadgeVariant> = {
  PAID: "fee-paid",
  UNPAID: "fee-unpaid",
  PARTIALLY_PAID: "fee-partial",
  ADVANCE: "fee-advance",
  REFUND: "fee-refund",
};

/* ── General ERP status → variant mapping ───────────────────── */
const STATUS_MAP: Record<string, BadgeVariant> = {
  // Success states
  ACTIVE: "success",
  PAID: "success",
  APPROVED: "success",
  COMPLETED: "success",

  // Danger states
  INACTIVE: "muted",
  DELETED: "destructive",
  OVERDUE: "destructive",
  REJECTED: "destructive",
  SUSPENDED: "destructive",

  // Warning states
  PENDING: "warning",
  PARTIAL: "warning",
  EXPIRING: "warning",

  // Info states
  DRAFT: "info",
  IN_PROGRESS: "info",
  PROCESSING: "info",
};

interface SxStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Auto-maps a fee status string to the fixed fee color variant */
  feeStatus?: string;
  /** Auto-maps a general ERP status string to a semantic variant */
  status?: string;
}

export function SxStatusBadge({
  className,
  variant,
  feeStatus,
  status,
  children,
  ...props
}: SxStatusBadgeProps) {
  // Priority: feeStatus > status > explicit variant
  const resolvedVariant = feeStatus
    ? FEE_STATUS_MAP[feeStatus.toUpperCase()] ?? "default"
    : status
      ? STATUS_MAP[status.toUpperCase()] ?? "default"
      : variant;

  const label =
    children ??
    feeStatus?.replace(/_/g, " ") ??
    status?.replace(/_/g, " ") ??
    "";

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {label}
    </span>
  );
}

export { badgeVariants };
