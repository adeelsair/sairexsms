/**
 * Webhook Worker — Processes payment gateway callbacks asynchronously
 *
 * Webhooks are received by the API route, validated for basic structure,
 * then pushed to this queue for async processing. This keeps the webhook
 * endpoint fast (returns 200 immediately) and makes processing retry-safe.
 */
import { Worker } from "bullmq";
import { getRedisConnection } from "../connection";
import { WEBHOOK_QUEUE } from "../queues";
import { startJob, completeJob, failJob } from "../enqueue";
import { processWebhook } from "@/lib/payments/payment.service";
import type { PaymentGateway } from "@/lib/generated/prisma";

interface WebhookJobData {
  jobId: string;
  gateway: PaymentGateway;
  payload: Record<string, unknown>;
  rawBody: string;
  signature: string | null;
  headers: Record<string, string>;
  receivedAt: string;
}

export function startWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE,
    async (job) => {
      const data = job.data;

      if (data.jobId) {
        await startJob(data.jobId, job.attemptsMade + 1);
      }

      try {
        const result = await processWebhook({
          gateway: data.gateway,
          payload: data.payload,
          rawBody: data.rawBody,
          signature: data.signature,
          headers: data.headers,
        });

        if (data.jobId) {
          await completeJob(data.jobId, {
            paymentRecordId: result.paymentRecordId,
            status: result.status,
          });
        }

        console.log(
          `[Webhook Worker] ${data.gateway} processed: ${result.status} → ${result.paymentRecordId}`,
        );

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown webhook processing error";

        if (data.jobId) {
          await failJob(
            data.jobId,
            msg,
            job.attemptsMade + 1,
            job.opts.attempts ?? 3,
          );
        }

        console.error(`[Webhook Worker] ${data.gateway} failed:`, msg);
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 10,
      limiter: {
        max: 50,
        duration: 1000,
      },
    },
  );

  worker.on("error", (err) => {
    console.error("[Webhook Worker] Error:", err.message);
  });

  console.log(`[Queue] Webhook worker started on "${WEBHOOK_QUEUE}"`);
  return worker;
}
