import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { SYSTEM_QUEUE } from "../queues";
import { startJob, completeJob, failJob } from "../enqueue";

/* ── Job Data Types ────────────────────────────────────── */

export interface SystemJobData {
  jobId: string;
}

/* ── Processor ─────────────────────────────────────────── */

async function processSystemJob(bull: BullJob<SystemJobData>): Promise<void> {
  const { jobId } = bull.data;
  const jobType = bull.name;

  await startJob(jobId, bull.attemptsMade + 1);

  if (jobType === "RECOVERY_SWEEP") {
    const { runRecoverySweep } = await import("../recovery");
    const result = await runRecoverySweep();

    await completeJob(jobId, {
      requeued: result.requeued,
      markedStale: result.markedStale,
    });
    return;
  }

  throw new Error(`Unknown system job type: ${jobType}`);
}

/* ── Worker Bootstrap ──────────────────────────────────── */

export function startSystemWorker(): Worker<SystemJobData> {
  const worker = new Worker<SystemJobData>(SYSTEM_QUEUE, processSystemJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`[System Worker] completed ${job.id} → ${job.name}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[System Worker] failed ${job?.id} → ${err.message}`);
    if (job?.data?.jobId) {
      await failJob(
        job.data.jobId,
        err.message,
        job.attemptsMade,
        job.opts.attempts ?? 2,
      );
    }
  });

  console.log("[System Worker] Started — listening on queue:", SYSTEM_QUEUE);
  return worker;
}
