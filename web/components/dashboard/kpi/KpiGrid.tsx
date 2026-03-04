import type { DailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { formatCurrency } from "@/lib/format/currency";
import { KpiCard } from "./KpiCard";

interface KpiGridProps {
  kpis: DailyOperationsSnapshot["kpis"];
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label="Fee Collected Today"
        value={formatCurrency(kpis.feeCollectedToday)}
      />
      <KpiCard label="New Admissions" value={kpis.newAdmissionsToday} />
      <KpiCard label="Students Present" value={kpis.studentsPresentToday} />
      <KpiCard label="Messages Sent" value={kpis.messagesSentToday} />
      <KpiCard label="Expenses" value={formatCurrency(kpis.expensesToday)} />
    </div>
  );
}
