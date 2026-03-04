import { cn } from "@/lib/utils";

/**
 * SAIREX Financial Data Rules:
 *
 * - Right aligned
 * - Mono font (JetBrains Mono via .font-data)
 * - Currency prefix
 * - Consistent decimals
 * - Tabular numerals
 *
 * All financial values in the UI must use this component.
 */

interface SxAmountProps {
  /** Numeric amount (preferred prop) */
  amount?: number | string | null;
  /** Backward-compatible alias used by some screens */
  value?: number | string | null;
  /** Currency prefix — defaults to "Rs." */
  currency?: string;
  /** Number of decimal places — defaults to 0 */
  decimals?: number;
  /** Locale for number formatting — defaults to "en-PK" */
  locale?: string;
  /** Show negative amounts in destructive color */
  colorNegative?: boolean;
  /** Additional classes */
  className?: string;
}

export function SxAmount({
  amount,
  value,
  currency = "Rs.",
  decimals = 0,
  locale = "en-PK",
  colorNegative = true,
  className,
}: SxAmountProps) {
  const resolvedAmount = amount ?? value;
  const numericAmount =
    typeof resolvedAmount === "number"
      ? resolvedAmount
      : Number(resolvedAmount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  const formatted = safeAmount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      className={cn(
        "inline-block text-right font-data",
        colorNegative && safeAmount < 0 && "text-destructive",
        className,
      )}
    >
      {currency} {formatted}
    </span>
  );
}
