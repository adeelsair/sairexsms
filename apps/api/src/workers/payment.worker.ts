import { Worker } from "bullmq";
import { createWorkerRedis } from "../lib/redis";
import {
  PAYMENT_QUEUE,
  PROCESS_PAYMENT_JOB,
  type ProcessPaymentJobData,
} from "../modules/payments/queue/payment.queue";
import { processPaymentWebhook } from "../modules/payments/services/payment.processor";

export function startPaymentWorker() {
  const worker = new Worker<ProcessPaymentJobData>(
    PAYMENT_QUEUE,
    async (job) => {
      if (job.name !== PROCESS_PAYMENT_JOB) return;
      await processPaymentWebhook(job.data);
    },
    {
      connection: createWorkerRedis(),
      concurrency: Number(process.env.PAYMENT_WORKER_CONCURRENCY ?? 10),
    },
  );

  worker.on("error", (error) => {
    console.error("[payments-worker] worker error:", error.message);
  });
  worker.on("failed", (job, error) => {
    console.error("[payments-worker] job failed:", job?.id, error.message);
  });
  worker.on("completed", (job) => {
    console.log("[payments-worker] job completed:", job.id);
  });

  return worker;
}

if (process.env.START_PAYMENT_WORKER === "1") {
  startPaymentWorker();
  console.log("[payments-worker] started");
}
