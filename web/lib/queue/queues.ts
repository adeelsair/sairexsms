import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { getRedisConnection } from "./connection";

const queues = new Map<string, Queue>();

interface QueueOverrides {
  attempts?: number;
  backoff?: { type: "exponential" | "fixed"; delay: number };
}

const QUEUE_DEFAULTS: Record<string, QueueOverrides> = {
  finance: { attempts: 2, backoff: { type: "fixed", delay: 5000 } },
  promotion: { attempts: 1 },
  reminder: { attempts: 5, backoff: { type: "exponential", delay: 3000 } },
  scheduler: { attempts: 1 },
  system: { attempts: 2, backoff: { type: "fixed", delay: 10000 } },
};

export function getQueue(name: string): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const overrides = QUEUE_DEFAULTS[name];

  const queue = new Queue(name, {
    connection: getRedisConnection() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: overrides?.attempts ?? 3,
      backoff: overrides?.backoff ?? { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
    },
  });

  queues.set(name, queue);
  return queue;
}

/* ── Messaging queues ──────────────────────────────────── */
export const EMAIL_QUEUE = "email";
export const OTP_QUEUE = "otp";
export const SMS_QUEUE = "sms";
export const WHATSAPP_QUEUE = "whatsapp";
export const NOTIFICATION_QUEUE = "notification";
export const CHALLAN_PDF_QUEUE = "challan-pdf";
export const REPORT_QUEUE = "report";
export const BULK_SMS_QUEUE = "bulk-sms";
export const IMPORT_QUEUE = "import";

/* ── Domain queues ─────────────────────────────────────── */
export const FINANCE_QUEUE = "finance";
export const PROMOTION_QUEUE = "promotion";
export const REMINDER_QUEUE = "reminder";
export const SCHEDULER_QUEUE = "scheduler";
export const SYSTEM_QUEUE = "system";

/* ── Payment gateway queue ─────────────────────────────── */
export const WEBHOOK_QUEUE = "webhook";

/* ── Event-driven architecture queue ───────────────────── */
export const EVENT_HANDLER_QUEUE = "event-handlers";
