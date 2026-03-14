import type { Request, Response } from "express";
import { PaymentProvider } from "../payments.types";
import {
  buildPaymentWebhookJobId,
  paymentQueue,
  PROCESS_PAYMENT_JOB,
} from "../queue/payment.queue";

export async function paymentWebhook(req: Request, res: Response) {
  try {
    const provider = req.params.provider as PaymentProvider;
    if (!Object.values(PaymentProvider).includes(provider)) {
      res.status(400).json({ error: "Unsupported payment provider" });
      return;
    }
    const payload = req.body;
    const headers: Record<string, string | string[] | undefined> = {
      "x-onebill-signature": req.headers["x-onebill-signature"],
      "x-signature": req.headers["x-signature"],
    };

    const jobId = buildPaymentWebhookJobId(provider, payload);
    await paymentQueue.add(
      PROCESS_PAYMENT_JOB,
      { provider, payload, headers },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    res.status(200).json({ status: "queued", jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    if (message.toLowerCase().includes("jobid") && message.toLowerCase().includes("exists")) {
      res.status(200).json({ status: "queued_duplicate" });
      return;
    }
    res.status(500).json({ error: message });
  }
}

