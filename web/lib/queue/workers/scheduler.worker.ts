import { Worker, Job as BullJob } from "bullmq";
import { enqueue } from "../enqueue";
import { getRedisConnection } from "../connection";
import { getQueue, REMINDER_QUEUE, SCHEDULER_QUEUE } from "../queues";
import { prisma } from "@/lib/prisma";

const REMINDER_DAILY_JOB_NAME = "REMINDER_DAILY";
const REMINDER_DAILY_CRON = process.env.REMINDER_DAILY_CRON ?? "0 2 * * *";
const REMINDER_DAILY_CRON_JOB_ID = "REMINDER_DAILY_CRON";

interface ReminderDailyJobData {
  dateKey?: string;
}

function resolveDateKey(dateKey?: string): string {
  return dateKey ?? new Date().toISOString().slice(0, 10);
}

export async function runReminderScheduler(dateKey?: string): Promise<number> {
  const dayKey = resolveDateKey(dateKey);
  const organizations = await prisma.organization.findMany({
    select: { id: true },
  });

  for (const org of organizations) {
    await enqueue({
      type: "REMINDER_RUN",
      queue: REMINDER_QUEUE,
      organizationId: org.id,
      payload: { organizationId: org.id },
      maxAttempts: 5,
      idempotencyKey: `reminder-run:${org.id}:${dayKey}`,
    });
  }

  return organizations.length;
}

async function processSchedulerJob(bull: BullJob<ReminderDailyJobData>): Promise<void> {
  if (bull.name !== REMINDER_DAILY_JOB_NAME) {
    throw new Error(`Unknown scheduler job type: ${bull.name}`);
  }

  const dateKey = resolveDateKey(bull.data.dateKey);
  const dispatched = await runReminderScheduler(dateKey);
  console.log(`[Scheduler Worker] dispatched ${dispatched} REMINDER_RUN jobs for ${dateKey}`);
}

export function startSchedulerWorker(): Worker<ReminderDailyJobData> {
  const worker = new Worker<ReminderDailyJobData>(SCHEDULER_QUEUE, processSchedulerJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`[Scheduler Worker] completed ${job.id} → ${job.name}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Scheduler Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Scheduler Worker] Started — listening on queue:", SCHEDULER_QUEUE);
  return worker;
}

export async function registerReminderDailySchedule(): Promise<void> {
  const queue = getQueue(SCHEDULER_QUEUE);
  await queue.add(
    REMINDER_DAILY_JOB_NAME,
    {},
    {
      jobId: REMINDER_DAILY_CRON_JOB_ID,
      repeat: { pattern: REMINDER_DAILY_CRON },
      removeOnComplete: 20,
      removeOnFail: 50,
    },
  );
  console.log(`[Scheduler Worker] Daily reminder schedule registered (${REMINDER_DAILY_CRON})`);
}
