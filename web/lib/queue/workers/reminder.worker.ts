import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { REMINDER_QUEUE } from "../queues";
import { startJob, completeJob, failJob, updateJobProgress } from "../enqueue";
import { enqueue, EMAIL_QUEUE, SMS_QUEUE, WHATSAPP_QUEUE } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import type { ReminderChannel } from "@/lib/generated/prisma";

/* ── Job Data Types ────────────────────────────────────── */

export interface ReminderRunJobData {
  jobId: string;
  organizationId: string;
  unitPath?: string | null;
  campusId?: number;
}

export interface ReminderDeliveryJobData {
  jobId: string;
  organizationId: string;
  channel: ReminderChannel;
  studentId: number;
  challanId: number;
  messageBody: string;
}

type ReminderJobData = ReminderRunJobData | ReminderDeliveryJobData;

function isReminderDeliveryJob(data: ReminderJobData): data is ReminderDeliveryJobData {
  return "channel" in data && "studentId" in data && "messageBody" in data;
}

async function processReminderDeliveryJob(data: ReminderDeliveryJobData): Promise<void> {
  const student = await prisma.student.findFirst({
    where: {
      id: data.studentId,
      organizationId: data.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!student) {
    throw new Error(`Student ${data.studentId} not found for reminder delivery`);
  }

  const toPhone: string | undefined = undefined;
  const toEmail: string | undefined = undefined;

  if (data.channel === "EMAIL") {
    if (!toEmail) {
      throw new Error(`Missing parent/guardian email for student ${data.studentId}`);
    }

    await enqueue({
      type: "EMAIL",
      queue: EMAIL_QUEUE,
      organizationId: data.organizationId,
      payload: {
        to: toEmail,
        subject: `Fee Reminder - Challan #${data.challanId}`,
        html: `<p>${data.messageBody}</p>`,
      },
      priority: 4,
      maxAttempts: 3,
    });
    return;
  }

  if (!toPhone) {
    throw new Error(`Missing parent/guardian phone for student ${data.studentId}`);
  }

  if (data.channel === "WHATSAPP") {
    await enqueue({
      type: "WHATSAPP",
      queue: WHATSAPP_QUEUE,
      organizationId: data.organizationId,
      payload: {
        to: toPhone,
        message: data.messageBody,
      },
      priority: 4,
      maxAttempts: 3,
    });
    return;
  }

  await enqueue({
    type: "SMS",
    queue: SMS_QUEUE,
    organizationId: data.organizationId,
    payload: {
      to: toPhone,
      message: data.messageBody,
    },
    priority: 4,
    maxAttempts: 3,
  });
}

/* ── Processor ─────────────────────────────────────────── */

async function processReminderJob(bull: BullJob<ReminderJobData>): Promise<void> {
  const { jobId } = bull.data;

  await startJob(jobId, bull.attemptsMade + 1);
  await updateJobProgress(jobId, 5);

  if (isReminderDeliveryJob(bull.data)) {
    await processReminderDeliveryJob(bull.data);
    await completeJob(jobId, {
      studentId: bull.data.studentId,
      challanId: bull.data.challanId,
      channel: bull.data.channel,
    });
    return;
  }

  const { organizationId, unitPath, campusId } = bull.data;
  const { runReminderEngine } = await import("@/lib/finance/reminder-engine.service");

  const result = await runReminderEngine({
    organizationId,
    unitPath,
    campusId,
  });

  await completeJob(jobId, {
    processed: result.processed,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    errorCount: result.errors.length,
  });
}

/* ── Worker Bootstrap ──────────────────────────────────── */

export function startReminderWorker(): Worker<ReminderJobData> {
  const worker = new Worker<ReminderJobData>(REMINDER_QUEUE, processReminderJob, {
    connection: getRedisConnection(),
    concurrency: 3,
    limiter: { max: 50, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Reminder Worker] completed ${job.id} → org ${job.data.organizationId}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[Reminder Worker] failed ${job?.id} → ${err.message}`);
    if (job?.data?.jobId) {
      await failJob(
        job.data.jobId,
        err.message,
        job.attemptsMade,
        job.opts.attempts ?? 5,
      );
    }
  });

  console.log("[Reminder Worker] Started — listening on queue:", REMINDER_QUEUE);
  return worker;
}
