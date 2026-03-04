import { forwardRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SAIREX Action Hierarchy:
 *
 * | Type      | Usage            | Rule                          |
 * |-----------|------------------|-------------------------------|
 * | primary   | Save / Generate  | Only ONE primary per screen   |
 * | secondary | Edit             |                               |
 * | outline   | Cancel           |                               |
 * | ghost     | Table actions    |                               |
 * | danger    | Delete           |                               |
 */
type SxVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ShadcnButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

interface SxButtonProps extends Omit<ShadcnButtonProps, "variant"> {
  /** ERP action variant — maps to shadcn variants + custom danger */
  sxVariant?: SxVariant;
  /** Shows a spinner and disables the button */
  loading?: boolean;
  /** Icon to show before children */
  icon?: React.ReactNode;
}

type ShadcnVariant = VariantProps<typeof buttonVariants>["variant"];

const variantMap: Record<SxVariant, { variant: ShadcnVariant; extra: string }> = {
  primary: {
    variant: "default",
    extra: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  secondary: {
    variant: "secondary",
    extra: "",
  },
  outline: {
    variant: "outline",
    extra: "",
  },
  ghost: {
    variant: "ghost",
    extra: "",
  },
  danger: {
    variant: "destructive",
    extra: "",
  },
};

const SxButton = forwardRef<HTMLButtonElement, SxButtonProps>(
  (
    {
      sxVariant = "primary",
      loading = false,
      icon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { variant, extra } = variantMap[sxVariant];
    const isAsChild = props.asChild === true;

    if (isAsChild) {
      return (
        <Button
          ref={ref}
          variant={variant}
          disabled={disabled || loading}
          className={cn("gap-2", extra, className)}
          {...props}
        >
          {children}
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        variant={variant}
        disabled={disabled || loading}
        className={cn("gap-2", extra, className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </Button>
    );
  },
);

SxButton.displayName = "SxButton";

export { SxButton, type SxVariant };
