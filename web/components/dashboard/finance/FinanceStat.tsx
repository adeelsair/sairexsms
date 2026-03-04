type FinanceStatProps = {
  label: string;
  value: string | number;
};

export function FinanceStat({ label, value }: FinanceStatProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
