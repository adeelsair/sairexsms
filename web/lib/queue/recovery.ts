import { prisma } from "@/lib/prisma";
import { getQueue } from "./queues";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Recovery sweep: finds PENDING or PROCESSING jobs in Postgres that have no
 * matching BullMQ job (e.g. Redis crash, worker OOM). Re-enqueues them.
 *
 * Also detects PROCESSING jobs that have been stuck beyond the stale threshold
 * and marks them FAILED so they become eligible for retry.
 *
 * Should be run periodically (e.g. every 5 minutes via a SYSTEM_QUEUE cron job).
 */
export async function runRecoverySweep(): Promise<{
  requeued: number;
  markedStale: number;
}> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  let requeued = 0;
  let markedStale = 0;

  const pendingJobs = await prisma.job.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const job of pendingJobs) {
    try {
      const queue = getQueue(job.queue);
      await queue.add(job.type, { jobId: job.id, ...(job.payload as Record<string, unknown>) }, {
        jobId: job.id,
        priority: job.priority,
      });
      requeued++;
    } catch {
      console.error(`[Recovery] Failed to re-enqueue job ${job.id}`);
    }
  }

  const staleJobs = await prisma.job.findMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: cutoff },
    },
    take: 50,
  });

  for (const job of staleJobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: job.attempts >= job.maxAttempts ? "DEAD" : "FAILED",
        failedAt: new Date(),
        error: "Marked stale by recovery sweep — exceeded 30 min processing time",
      },
    });
    markedStale++;
  }

  return { requeued, markedStale };
}
