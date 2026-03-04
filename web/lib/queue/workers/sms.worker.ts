import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { SMS_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface SmsJobData {
  jobId: string;
  to: string;
  message: string;
}

async function processSmsJob(bull: BullJob<SmsJobData>): Promise<void> {
  const { sendSmsMessage } = await import("@/lib/sms");

  const { jobId, to, message } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    await sendSmsMessage(to, message);

    await completeJob(jobId, { to });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown SMS error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw new Error(`SMS delivery failed to ${to}: ${errorMsg}`);
  }
}

export function startSmsWorker(): Worker<SmsJobData> {
  const worker = new Worker<SmsJobData>(SMS_QUEUE, processSmsJob, {
    connection: getRedisConnection(),
    concurrency: 3,
    limiter: { max: 5, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[SMS Worker] completed ${job.id} → ${job.data.to}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[SMS Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[SMS Worker] Started — listening on queue:", SMS_QUEUE);
  return worker;
}
