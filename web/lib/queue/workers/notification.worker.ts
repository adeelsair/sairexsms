import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { NOTIFICATION_QUEUE, EMAIL_QUEUE, SMS_QUEUE, WHATSAPP_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface NotificationJobData {
  jobId: string;
  studentName: string;
  parentEmail?: string;
  parentPhone?: string;
  challanNo: string;
  totalAmount: string;
  dueDate: string;
  type: "GENERATED" | "REMINDER" | "PAID";
  organizationId?: string;
}

const MESSAGES = {
  GENERATED: (s: string, c: string, amt: string, due: string) =>
    `Dear Parent, Challan ${c} for ${s} has been generated. Amount: ${amt}. Due: ${due}.`,
  REMINDER: (s: string, _c: string, amt: string, due: string) =>
    `REMINDER: Fee for ${s} is due in 3 days. Please pay ${amt} by ${due} to avoid late fine.`,
  PAID: (s: string, _c: string, amt: string, _due: string) =>
    `Payment Received! Thank you for paying ${amt} for ${s}. Your receipt is available online.`,
};

/**
 * Fan-out worker: receives a single NOTIFICATION job and spawns
 * individual EMAIL, SMS, and WHATSAPP child jobs.
 */
async function processNotificationJob(bull: BullJob<NotificationJobData>): Promise<void> {
  const { enqueue } = await import("../enqueue");

  const { jobId, studentName, parentEmail, parentPhone, challanNo, totalAmount, dueDate, type, organizationId } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    const message = MESSAGES[type](studentName, challanNo, totalAmount, dueDate);
    const childJobs: string[] = [];

    if (parentEmail) {
      const emailJobId = await enqueue({
        type: "EMAIL",
        queue: EMAIL_QUEUE,
        organizationId,
        payload: {
          to: parentEmail,
          subject: `Fee Notification - ${type}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e40af;">SAIREX SMS</h2>
            <p>${message}</p>
          </div>
        `,
        },
      });
      childJobs.push(emailJobId);
    }

    if (parentPhone) {
      const smsJobId = await enqueue({
        type: "SMS",
        queue: SMS_QUEUE,
        organizationId,
        payload: { to: parentPhone, message },
      });
      childJobs.push(smsJobId);

      const waJobId = await enqueue({
        type: "WHATSAPP",
        queue: WHATSAPP_QUEUE,
        organizationId,
        payload: { to: parentPhone, message },
      });
      childJobs.push(waJobId);
    }

    await completeJob(jobId, { childJobs });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown notification error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw err;
  }
}

export function startNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(NOTIFICATION_QUEUE, processNotificationJob, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    console.log(`[Notification Worker] completed ${job.id} → ${job.data.type} for ${job.data.studentName}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Notification Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Notification Worker] Started — listening on queue:", NOTIFICATION_QUEUE);
  return worker;
}
