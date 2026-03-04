/**
 * Event Handler Worker — processes async domain event handlers
 * dispatched by the event bus via the event-handlers queue.
 */
import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { startJob, completeJob, failJob } from "../enqueue";

const EVENT_HANDLER_QUEUE = "event-handlers";

interface EventHandlerJobData {
  jobId: string;
  eventId: string;
  eventType: string;
  handlerName: string;
  organizationId: string;
  initiatedByUserId?: number;
  occurredAt: string;
  eventPayload: Record<string, unknown>;
}

async function processEventHandler(bull: BullJob<EventHandlerJobData>): Promise<void> {
  const { jobId, eventId, eventType, handlerName, organizationId, initiatedByUserId, occurredAt, eventPayload } = bull.data;

  await startJob(jobId, bull.attemptsMade + 1);

  const { resolveHandler } = await import("@/lib/events/bus");
  const { initializeEventHandlers } = await import("@/lib/events/registry");

  initializeEventHandlers();

  const reg = resolveHandler(handlerName);
  if (!reg) {
    throw new Error(`Handler "${handlerName}" not found in registry`);
  }

  const event = {
    eventId,
    eventType,
    occurredAt: new Date(occurredAt),
    organizationId,
    initiatedByUserId,
    payload: eventPayload,
  };

  await reg.handler(event);

  await completeJob(jobId, { eventId, handlerName });
}

export function startEventHandlerWorker(): Worker<EventHandlerJobData> {
  const worker = new Worker<EventHandlerJobData>(EVENT_HANDLER_QUEUE, processEventHandler, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    console.log(`[Event Worker] completed ${job.id} → ${job.data.handlerName} for ${job.data.eventType}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[Event Worker] failed ${job?.id} → ${err.message}`);
    if (job?.data?.jobId) {
      await failJob(
        job.data.jobId,
        err.message,
        job.attemptsMade,
        job.opts.attempts ?? 3,
      );
    }
  });

  console.log("[Event Worker] Started — listening on queue:", EVENT_HANDLER_QUEUE);
  return worker;
}
