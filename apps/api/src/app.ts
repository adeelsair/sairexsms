import express from "express";
import { registerPaymentsModule } from "./modules/payments/payments.module";
import { startPaymentReconciliationJob } from "./jobs/payment.reconciliation.job";
import { startPaymentLateFeeJob } from "./jobs/payment.latefee.job";

export const app = express();

app.use(express.json());
registerPaymentsModule(app);
if (process.env.PAYMENT_RECONCILIATION_CRON === "1") {
  startPaymentReconciliationJob();
}
if (process.env.PAYMENT_LATEFEE_CRON === "1") {
  startPaymentLateFeeJob();
}

