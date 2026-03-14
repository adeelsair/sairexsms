import { Queue } from "bullmq";
import { redis } from "../../../lib/redis";
import { PaymentProvider } from "../payments.types";

export interface ProcessPaymentJobData {
  provider: PaymentProvider;
  payload: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export const PAYMENT_QUEUE = "payments";
export const PROCESS_PAYMENT_JOB = "process-payment";

export const paymentQueue = new Queue<ProcessPaymentJobData>(PAYMENT_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 24 * 3600, count: 2000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 10000 },
  },
});

function extractTransactionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.transactionId,
    record.txn,
    record.txnId,
    record.reference,
    record.billReference,
  ];
  for (const value of candidates) {
    const id = String(value ?? "").trim();
    if (id) return id;
  }
  return null;
}

export function buildPaymentWebhookJobId(provider: PaymentProvider, payload: unknown) {
  const transactionId = extractTransactionId(payload);
  if (transactionId) {
    const normalized = `${provider}_${transactionId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    return normalized;
  }
  return `${provider}_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
