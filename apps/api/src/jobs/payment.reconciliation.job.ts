import cron from "node-cron";
import { ReconciliationService } from "../modules/payments/reconciliation/reconciliation.service";
import { PaymentProvider } from "../modules/payments/payments.types";

let isStarted = false;

export function startPaymentReconciliationJob() {
  if (isStarted) return;
  isStarted = true;

  const service = new ReconciliationService();

  cron.schedule("0 3 * * *", async () => {
    try {
      await service.reconcileProvider(PaymentProvider.ONEBILL);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reconciliation failure";
      console.error("[payments] reconciliation job failed:", message);
    }
  });
}
