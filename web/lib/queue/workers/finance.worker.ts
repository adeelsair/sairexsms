import { Worker, Job as BullJob } from "bullmq";
import * as Sentry from "@sentry/nextjs";
import { getRedisConnection } from "../connection";
import { FINANCE_QUEUE } from "../queues";
import { startJob, completeJob, failJob, updateJobProgress } from "../enqueue";
import { logger } from "@/lib/logger";

/* ── Job Data Types ────────────────────────────────────── */

export interface MonthlyPostingJobData {
  jobId: string;
  organizationId: string;
  month: number;
  year: number;
  userId: number;
  campusId?: number;
  dueDate?: string;
}

export interface ReconcilePaymentJobData {
  jobId: string;
  paymentRecordId: string;
  challanId: number;
  organizationId: string;
}

type FinanceJobData = MonthlyPostingJobData | ReconcilePaymentJobData;

/* ── Processor ─────────────────────────────────────────── */

async function processFinanceJob(bull: BullJob<FinanceJobData>): Promise<void> {
  const { jobId } = bull.data;
  const jobType = bull.name;
  const orgId = "organizationId" in bull.data ? bull.data.organizationId : undefined;

  await startJob(jobId, bull.attemptsMade + 1);
  logger.info({ jobId, jobType, attempt: bull.attemptsMade + 1 }, "Finance job started");

  try {
    if (jobType === "MONTHLY_POSTING") {
      const data = bull.data as MonthlyPostingJobData;
      const { runMonthlyPosting } = await import("@/lib/finance/fee-posting.service");

      await updateJobProgress(jobId, 10);

      const result = await runMonthlyPosting({
        organizationId: data.organizationId,
        month: data.month,
        year: data.year,
        userId: data.userId,
        campusId: data.campusId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });

      logger.info({ jobId, orgId: data.organizationId, month: data.month, year: data.year, totalChallans: result.totalChallans, totalAmount: result.totalAmount }, "Monthly posting completed");
      await completeJob(jobId, {
        postingRunId: result.postingRunId,
        totalStudents: result.totalStudents,
        totalChallans: result.totalChallans,
        totalAmount: result.totalAmount,
      });
      return;
    }

    if (jobType === "RECONCILE_PAYMENT") {
      const data = bull.data as ReconcilePaymentJobData;
      const { reconcilePayment } = await import("@/lib/finance/reconciliation.service");

      await updateJobProgress(jobId, 20);

      const result = await reconcilePayment({
        paymentRecordId: data.paymentRecordId,
        challanId: data.challanId,
        organizationId: data.organizationId,
      });

      logger.info({ jobId, orgId: data.organizationId, challanId: data.challanId, challanStatus: result.challanStatus, amount: result.newPaidAmount }, "Payment reconciled");
      await completeJob(jobId, {
        challanStatus: result.challanStatus,
        newPaidAmount: result.newPaidAmount,
        ledgerEntryId: result.ledgerEntryId,
      });
      return;
    }

    throw new Error(`Unknown finance job type: ${jobType}`);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { jobName: jobType, orgId: orgId ?? "unknown" },
      extra: { jobId, attempt: bull.attemptsMade + 1 },
    });
    throw err;
  }
}

/* ── Worker Bootstrap ──────────────────────────────────── */

export function startFinanceWorker(): Worker<FinanceJobData> {
  const worker = new Worker<FinanceJobData>(FINANCE_QUEUE, processFinanceJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.debug({ bullId: job.id, jobType: job.name }, "Finance job completed");
  });

  worker.on("failed", async (job, err) => {
    logger.error({ bullId: job?.id, jobType: job?.name, err }, "Finance job failed");
    if (job?.data?.jobId) {
      await failJob(
        job.data.jobId,
        err.message,
        job.attemptsMade,
        job.opts.attempts ?? 2,
      );
    }
  });

  logger.info({ queue: FINANCE_QUEUE }, "Finance worker started");
  return worker;
}
