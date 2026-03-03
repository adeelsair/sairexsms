import { prisma } from "@/lib/prisma";
import { getQueue } from "./queues";
import type { JobsOptions } from "bullmq";
import type { Prisma } from "@/lib/generated/prisma";

export interface EnqueueOptions {
  type: string;
  queue: string;
  payload: Record<string, unknown>;
  userId?: number;
  organizationId?: string;
  priority?: number;
  delay?: number;
  scheduledAt?: Date;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
  maxAttempts?: number;
}

/**
 * Dual-write: creates a Postgres Job record for audit trail,
 * then enqueues to BullMQ for async processing.
 *
 * If Redis is unavailable, the Postgres record is still created
 * (status PENDING) so a recovery sweep can pick it up later.
 *
 * If an idempotencyKey is supplied and a non-terminal job already
 * exists with that key, returns the existing job ID (no duplicate).
 */
export async function enqueue(opts: EnqueueOptions): Promise<string> {
  const payloadJson = opts.payload as unknown as Prisma.InputJsonValue;

  if (opts.idempotencyKey) {
    const existing = await prisma.job.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
      select: { id: true, status: true },
    });
    if (existing && !["FAILED", "DEAD"].includes(existing.status)) {
      return existing.id;
    }
  }

  const job = await prisma.job.create({
    data: {
      type: opts.type,
      queue: opts.queue,
      payload: payloadJson,
      priority: opts.priority ?? 0,
      maxAttempts: opts.maxAttempts ?? 3,
      scheduledAt: opts.scheduledAt ?? null,
      userId: opts.userId ?? null,
      organizationId: opts.organizationId ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      referenceId: opts.referenceId ?? null,
      referenceType: opts.referenceType ?? null,
    },
  });

  try {
    const bullOpts: JobsOptions = {
      jobId: job.id,
      priority: opts.priority,
    };

    if (opts.maxAttempts) {
      bullOpts.attempts = opts.maxAttempts;
    }

    if (opts.delay) {
      bullOpts.delay = opts.delay;
    } else if (opts.scheduledAt) {
      const ms = opts.scheduledAt.getTime() - Date.now();
      if (ms > 0) bullOpts.delay = ms;
    }

    const queue = getQueue(opts.queue);
    await queue.add(opts.type, { jobId: job.id, ...opts.payload }, bullOpts);
  } catch (err) {
    console.error(`[Queue] Failed to enqueue ${opts.type} to Redis (job ${job.id} saved in DB):`, err);
  }

  return job.id;
}

/**
 * Update progress (0–100) on a running job. Workers should call
 * this periodically during long-running operations.
 */
export async function updateJobProgress(jobId: string, progress: number): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { progress: Math.min(100, Math.max(0, Math.round(progress))) },
  });
}

/**
 * Mark a job as completed with optional result data.
 */
export async function completeJob(jobId: string, result?: Record<string, unknown>): Promise<void> {
  const resultJson = result
    ? (result as unknown as Prisma.InputJsonValue)
    : undefined;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      error: null,
      result: resultJson,
    },
  });
}

/**
 * Mark a job as failed. If attempts are exhausted, marks as DEAD.
 */
export async function failJob(
  jobId: string,
  error: string,
  attemptsMade: number,
  maxAttempts: number,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: attemptsMade >= maxAttempts ? "DEAD" : "FAILED",
      failedAt: new Date(),
      error,
      attempts: attemptsMade,
    },
  });
}

/**
 * Transition a job to PROCESSING state at the start of execution.
 */
export async function startJob(jobId: string, attemptsMade: number): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: attemptsMade,
    },
  });
}
