import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { BULK_SMS_QUEUE, SMS_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface BulkSmsJobData {
  jobId: string;
  message: string;
  recipients: { name?: string; phone: string }[];
  organizationId?: string;
}

/**
 * Fan-out worker: receives a BULK_SMS job with N recipients,
 * spawns an individual SMS job for each recipient.
 */
async function processBulkSmsJob(bull: BullJob<BulkSmsJobData>): Promise<void> {
  const { enqueue } = await import("../enqueue");

  const { jobId, message, recipients, organizationId } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    const childJobs: string[] = [];

    for (const recipient of recipients) {
      const personalised = recipient.name
        ? message.replace(/\{name\}/gi, recipient.name)
        : message;

      const childId = await enqueue({
        type: "SMS",
        queue: SMS_QUEUE,
        organizationId,
        payload: { to: recipient.phone, message: personalised },
      });
      childJobs.push(childId);
    }

    await completeJob(jobId, {
      totalRecipients: recipients.length,
      childJobs,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown bulk SMS error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw err;
  }
}

export function startBulkSmsWorker(): Worker<BulkSmsJobData> {
  const worker = new Worker<BulkSmsJobData>(BULK_SMS_QUEUE, processBulkSmsJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[Bulk SMS Worker] completed ${job.id} → ${job.data.recipients.length} recipients`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Bulk SMS Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Bulk SMS Worker] Started — listening on queue:", BULK_SMS_QUEUE);
  return worker;
}
