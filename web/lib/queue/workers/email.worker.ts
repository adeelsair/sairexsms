import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { EMAIL_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface EmailJobData {
  jobId: string;
  to: string;
  subject: string;
  html: string;
}

async function processEmailJob(bull: BullJob<EmailJobData>): Promise<void> {
  const { sendEmail } = await import("@/lib/email");

  const { jobId, to, subject, html } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  const success = await sendEmail({ to, subject, html });

  if (!success) {
    await failJob(jobId, `Email delivery failed to ${to}`, attemptsMade, maxAttempts);
    throw new Error(`Email delivery failed to ${to}`);
  }

  await completeJob(jobId, { to, subject });
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmailJob, {
    connection: getRedisConnection(),
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Email Worker] completed ${job.id} → ${job.data.to}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Email Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Email Worker] Started — listening on queue:", EMAIL_QUEUE);
  return worker;
}
