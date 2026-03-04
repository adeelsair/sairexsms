import type { DailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { formatCurrency } from "@/lib/format/currency";
import { FinanceStat } from "./FinanceStat";

interface FinanceStreamProps {
  finance: DailyOperationsSnapshot["financeToday"];
}

export function FinanceStream({ finance }: FinanceStreamProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Today&apos;s Financial Flow
      </h2>

      <div className="grid gap-4 md:grid-cols-4">
        <FinanceStat
          label="Invoices Generated"
          value={finance.invoicesGenerated}
        />
        <FinanceStat
          label="Payments Received"
          value={finance.paymentsReceived}
        />
        <FinanceStat
          label="Outstanding Receivable"
          value={formatCurrency(finance.outstandingAmount)}
        />
        <FinanceStat
          label="Auto Reminders Sent"
          value={finance.autoRemindersSent}
        />
      </div>
    </div>
  );
}
