/**
 * SMS engine smoke test (queue + worker).
 *
 * Usage:
 *   SMS_DRY_RUN=true npx tsx scripts/test-sms-engine.ts
 *   SMS_TEST_PHONE=03001234567 SMS_TEST_COUNT=20 SMS_DRY_RUN=true npx tsx scripts/test-sms-engine.ts
 */
import { prisma } from "@/lib/prisma";
import { enqueue, BULK_SMS_QUEUE } from "@/lib/queue";
import IORedis from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";
import { startBulkSmsWorker } from "@/lib/queue/workers/bulk-sms.worker";
import { startSmsWorker } from "@/lib/queue/workers/sms.worker";

type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD" | "RETRYING";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCount(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function waitForTerminalStatus(
  jobId: string,
  timeoutMs: number,
): Promise<JobStatus> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    const status = (job?.status ?? "PENDING") as JobStatus;
    if (["COMPLETED", "FAILED", "DEAD"].includes(status)) {
      return status;
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for job ${jobId}`);
}

async function main() {
  process.env.SMS_DRY_RUN = process.env.SMS_DRY_RUN ?? "true";
  const phone = process.env.SMS_TEST_PHONE ?? "03001234567";
  const count = parseCount(process.env.SMS_TEST_COUNT, 10);
  const timeoutMs = parseCount(process.env.SMS_TEST_TIMEOUT_MS, 120000);

  console.log(`[SMS Test] Starting with count=${count}, dryRun=${process.env.SMS_DRY_RUN}`);

  const redisProbe = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await redisProbe.connect();
    await redisProbe.ping();
  } catch (error) {
    redisProbe.disconnect();
    throw new Error(
      `Redis is not reachable. Set REDIS_HOST/REDIS_URL for this environment. ${String(error)}`,
    );
  }
  redisProbe.disconnect();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Database is not reachable. Set DATABASE_URL for this environment. ${String(error)}`,
    );
  }

  const redis = getRedisConnection();
  const bulkWorker = startBulkSmsWorker();
  const smsWorker = startSmsWorker();

  try {
    const recipients = Array.from({ length: count }, (_, index) => ({
      name: `Parent ${index + 1}`,
      phone,
    }));

    const parentJobId = await enqueue({
      type: "BULK_SMS",
      queue: BULK_SMS_QUEUE,
      payload: {
        message: "SairexSMS test message for {name}.",
        recipients,
      },
    });

    console.log(`[SMS Test] Enqueued parent job: ${parentJobId}`);
    const parentStatus = await waitForTerminalStatus(parentJobId, timeoutMs);

    const parentJob = await prisma.job.findUnique({
      where: { id: parentJobId },
      select: { status: true, result: true, error: true },
    });

    if (parentStatus !== "COMPLETED") {
      throw new Error(
        `[SMS Test] Parent job failed: status=${parentJob?.status ?? "UNKNOWN"} error=${parentJob?.error ?? "n/a"}`,
      );
    }

    const rawResult = parentJob?.result as { childJobs?: string[] } | null;
    const childJobIds = rawResult?.childJobs ?? [];

    if (childJobIds.length !== count) {
      throw new Error(
        `[SMS Test] Expected ${count} child jobs, got ${childJobIds.length}`,
      );
    }

    const childJobs = await prisma.job.findMany({
      where: { id: { in: childJobIds } },
      select: { id: true, status: true, error: true },
    });

    const failed = childJobs.filter((job) => job.status === "FAILED" || job.status === "DEAD");
    const pending = childJobs.filter((job) => !["COMPLETED", "FAILED", "DEAD"].includes(job.status));

    if (pending.length > 0) {
      for (const pendingJob of pending) {
        await waitForTerminalStatus(pendingJob.id, timeoutMs);
      }
    }

    const refreshed = await prisma.job.findMany({
      where: { id: { in: childJobIds } },
      select: { status: true, error: true },
    });

    const completedCount = refreshed.filter((job) => job.status === "COMPLETED").length;
    const failedCount = refreshed.filter((job) => job.status === "FAILED" || job.status === "DEAD").length;

    console.log(`[SMS Test] Completed child jobs: ${completedCount}/${count}`);
    if (failedCount > 0) {
      console.error("[SMS Test] Failed child jobs:", refreshed.filter((job) => job.status !== "COMPLETED"));
      process.exitCode = 1;
      return;
    }

    if (failed.length > 0) {
      console.error("[SMS Test] Initial failures:", failed);
    }

    console.log("[SMS Test] PASS");
  } finally {
    await Promise.allSettled([bulkWorker.close(), smsWorker.close()]);
    redis.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[SMS Test] FAIL:", error);
  process.exitCode = 1;
});

