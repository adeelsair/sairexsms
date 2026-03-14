import type { Express } from "express";
import paymentsRouter from "./payments.router";
import { PaymentsService } from "./payments.service";

export function registerPaymentsModule(app: Express) {
  app.use("/payments", paymentsRouter);
}

export { paymentsRouter, PaymentsService };
export * from "./payments.types";

