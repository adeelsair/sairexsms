import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════
   SxFormLayout — Page-level form container
   Structure: PageHeader → FormCard → Sections → Sticky Actions
   ══════════════════════════════════════════════════════════════ */

interface SxFormLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function SxFormLayout({ children, className }: SxFormLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-4xl space-y-6", className)}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SxFormCard — White/dark elevated card wrapping form fields
   ══════════════════════════════════════════════════════════════ */

interface SxFormCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SxFormCard({ children, className }: SxFormCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SxFormSection — Section title + field grid inside a card
   ══════════════════════════════════════════════════════════════ */

interface SxFormSectionProps {
  title?: string;
  description?: string;
  /** Column count: 1 | 2 | 3 — responsive by default */
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}

export function SxFormSection({
  title,
  description,
  columns = 2,
  children,
  className,
}: SxFormSectionProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <fieldset className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && (
            <legend className="text-lg font-semibold tracking-tight">
              {title}
            </legend>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className={cn("grid gap-4", gridCols[columns])}>{children}</div>
    </fieldset>
  );
}

/* ══════════════════════════════════════════════════════════════
   SxFormField — Single field wrapper with label + helper + error
   ══════════════════════════════════════════════════════════════ */

interface SxFormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  /** Span full width in grid */
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SxFormField({
  label,
  htmlFor,
  required,
  helper,
  error,
  fullWidth,
  children,
  className,
}: SxFormFieldProps) {
  return (
    <div
      className={cn(
        "space-y-1.5",
        fullWidth && "sm:col-span-2 lg:col-span-3",
        className,
      )}
    >
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>

      {children}

      {helper && !error && (
        <p className="text-xs text-muted-foreground">{helper}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SxActionBar — Sticky bottom bar for form submit/cancel
   ══════════════════════════════════════════════════════════════ */

interface SxActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function SxActionBar({ children, className }: SxActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6",
        "flex items-center justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
