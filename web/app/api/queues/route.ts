import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getQueue,
  EMAIL_QUEUE,
  OTP_QUEUE,
  SMS_QUEUE,
  WHATSAPP_QUEUE,
  NOTIFICATION_QUEUE,
  CHALLAN_PDF_QUEUE,
  REPORT_QUEUE,
  BULK_SMS_QUEUE,
  IMPORT_QUEUE,
  FINANCE_QUEUE,
  PROMOTION_QUEUE,
  REMINDER_QUEUE,
  SCHEDULER_QUEUE,
  SYSTEM_QUEUE,
  WEBHOOK_QUEUE,
  EVENT_HANDLER_QUEUE,
} from "@/lib/queue";

interface QueueSummary {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  totalOpen: number;
}

const MONITORED_QUEUES = [
  EMAIL_QUEUE,
  OTP_QUEUE,
  SMS_QUEUE,
  WHATSAPP_QUEUE,
  NOTIFICATION_QUEUE,
  CHALLAN_PDF_QUEUE,
  REPORT_QUEUE,
  BULK_SMS_QUEUE,
  IMPORT_QUEUE,
  FINANCE_QUEUE,
  PROMOTION_QUEUE,
  REMINDER_QUEUE,
  SCHEDULER_QUEUE,
  SYSTEM_QUEUE,
  WEBHOOK_QUEUE,
  EVENT_HANDLER_QUEUE,
] as const;

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const summaries: QueueSummary[] = await Promise.all(
      MONITORED_QUEUES.map(async (queueName) => {
        const queue = getQueue(queueName);
        const counts = await queue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "completed",
          "failed",
        );

        const waiting = counts.waiting ?? 0;
        const active = counts.active ?? 0;
        const delayed = counts.delayed ?? 0;
        const completed = counts.completed ?? 0;
        const failed = counts.failed ?? 0;

        return {
          name: queueName,
          waiting,
          active,
          delayed,
          completed,
          failed,
          totalOpen: waiting + active + delayed,
        };
      }),
    );

    return NextResponse.json({
      queues: summaries,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load queue metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
