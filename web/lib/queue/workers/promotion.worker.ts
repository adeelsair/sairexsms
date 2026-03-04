import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { PROMOTION_QUEUE } from "../queues";
import { startJob, completeJob, failJob, updateJobProgress } from "../enqueue";

/* ── Job Data Types ────────────────────────────────────── */

export interface RolloverJobData {
  jobId: string;
  organizationId: string;
  fromAcademicYearId: string;
  newYearName: string;
  newYearStartDate: string;
  newYearEndDate: string;
  cloneSubjects?: boolean;
  userId: number;
}

export interface PromoteJobData {
  jobId: string;
  organizationId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  config: {
    passingPercentage: number;
    useAttendance: boolean;
    minAttendancePercentage: number;
  };
  userId: number;
}

type PromotionJobData = RolloverJobData | PromoteJobData;

/* ── Processor ─────────────────────────────────────────── */

async function processPromotionJob(bull: BullJob<PromotionJobData>): Promise<void> {
  const { jobId } = bull.data;
  const jobType = bull.name;

  await startJob(jobId, bull.attemptsMade + 1);

  if (jobType === "ROLLOVER_STRUCTURE") {
    const data = bull.data as RolloverJobData;
    const { rolloverStructure } = await import("@/lib/academic/promotion.service");

    await updateJobProgress(jobId, 10);

    const result = await rolloverStructure({
      organizationId: data.organizationId,
      fromAcademicYearId: data.fromAcademicYearId,
      newYearName: data.newYearName,
      newYearStartDate: new Date(data.newYearStartDate),
      newYearEndDate: new Date(data.newYearEndDate),
      cloneSubjects: data.cloneSubjects,
      userId: data.userId,
    });

    await completeJob(jobId, {
      newAcademicYear: result.newAcademicYear,
      classesCloned: result.classesCloned,
      sectionsCloned: result.sectionsCloned,
    });
    return;
  }

  if (jobType === "PROMOTION_RUN") {
    const data = bull.data as PromoteJobData;
    const { runPromotion } = await import("@/lib/academic/promotion.service");

    await updateJobProgress(jobId, 5);

    const result = await runPromotion({
      organizationId: data.organizationId,
      fromAcademicYearId: data.fromAcademicYearId,
      toAcademicYearId: data.toAcademicYearId,
      config: data.config,
      userId: data.userId,
    });

    await completeJob(jobId, {
      promotionRunId: result.promotionRunId,
      totalStudents: result.totalStudents,
      promoted: result.promoted,
      retained: result.retained,
      graduated: result.graduated,
      errors: result.errors,
    });
    return;
  }

  throw new Error(`Unknown promotion job type: ${jobType}`);
}

/* ── Worker Bootstrap ──────────────────────────────────── */

export function startPromotionWorker(): Worker<PromotionJobData> {
  const worker = new Worker<PromotionJobData>(PROMOTION_QUEUE, processPromotionJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`[Promotion Worker] completed ${job.id} → ${job.name}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[Promotion Worker] failed ${job?.id} → ${err.message}`);
    if (job?.data?.jobId) {
      await failJob(
        job.data.jobId,
        err.message,
        job.attemptsMade,
        job.opts.attempts ?? 1,
      );
    }
  });

  console.log("[Promotion Worker] Started — listening on queue:", PROMOTION_QUEUE);
  return worker;
}
