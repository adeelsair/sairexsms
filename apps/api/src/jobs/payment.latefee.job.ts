import cron from "node-cron";
import { PaymentsService } from "../modules/payments/payments.service";

let isStarted = false;

export function startPaymentLateFeeJob() {
  if (isStarted) return;
  isStarted = true;

  const service = new PaymentsService();
  const lateFeeAmount = Number(process.env.PAYMENT_LATE_FEE_DEFAULT ?? "500");

  cron.schedule("30 2 * * *", async () => {
    try {
      const result = await service.applyLateFeesDaily(lateFeeAmount);
      if (result.applied > 0) {
        console.log(`[payments] late fee job applied to ${result.applied} invoice(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown late fee job failure";
      await service.logEvent("reconciliation_error", {
        source: "late_fee_job",
        error: message,
      });
      console.error("[payments] late fee job failed:", message);
    }
  });
}
