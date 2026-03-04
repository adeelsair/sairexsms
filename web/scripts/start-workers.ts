/**
 * Standalone worker process — run with:
 *   npx tsx scripts/start-workers.ts
 *
 * In production, run this as a separate process alongside `next start`.
 *
 * Production topology:
 *   API server:    next start         (2+ pods)
 *   Worker:        tsx start-workers  (1–4 pods, scale independently)
 *   Redis:         managed instance
 */
import { startWorkers } from "../lib/queue/workers";
import { enqueue, SYSTEM_QUEUE } from "../lib/queue";
import { initializeEventHandlers } from "../lib/events";
import { getRedisConnection } from "../lib/queue/connection";
import {
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from "../lib/queue/worker-runtime";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
let recoveryTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

process.env.SAIREX_WORKER_PROCESS = "true";

async function publishWorkerHeartbeat() {
  const redis = getRedisConnection();
  await redis.set(
    WORKER_HEARTBEAT_KEY,
    new Date().toISOString(),
    "EX",
    WORKER_HEARTBEAT_TTL_SECONDS,
  );
}

async function scheduleRecoverySweep() {
  try {
    await enqueue({
      type: "RECOVERY_SWEEP",
      queue: SYSTEM_QUEUE,
      payload: {},
      idempotencyKey: `recovery-sweep-${Date.now()}`,
    });
  } catch (err) {
    console.error("[Recovery] Failed to schedule sweep:", err);
  }
}

function shutdown() {
  console.log("\n[Workers] Shutting down…");
  if (recoveryTimer) clearInterval(recoveryTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  setTimeout(() => process.exit(0), 3000);
}

initializeEventHandlers();
startWorkers();

recoveryTimer = setInterval(scheduleRecoverySweep, RECOVERY_INTERVAL_MS);
console.log(`[Workers] Recovery sweep scheduled every ${RECOVERY_INTERVAL_MS / 1000}s`);

void publishWorkerHeartbeat();
heartbeatTimer = setInterval(() => {
  void publishWorkerHeartbeat();
}, HEARTBEAT_INTERVAL_MS);
console.log(`[Workers] Heartbeat published every ${HEARTBEAT_INTERVAL_MS / 1000}s`);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[Workers] Running. Press Ctrl+C to stop.");
