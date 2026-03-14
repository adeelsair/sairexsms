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
import { loadEnvConfig } from "@next/env";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
let recoveryTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

process.env.SAIREX_WORKER_PROCESS = "true";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function publishWorkerHeartbeat() {
  const { getRedisConnection } = await import("../lib/queue/connection");
  const { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } = await import("../lib/queue/worker-runtime");
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
    const { enqueue, SYSTEM_QUEUE } = await import("../lib/queue");
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

async function bootstrap() {
  const [{ initializeEventHandlers }, { startWorkers }] = await Promise.all([
    import("../lib/events"),
    import("../lib/queue/workers"),
  ]);

  initializeEventHandlers();
  startWorkers();

  recoveryTimer = setInterval(scheduleRecoverySweep, RECOVERY_INTERVAL_MS);
  console.log(`[Workers] Recovery sweep scheduled every ${RECOVERY_INTERVAL_MS / 1000}s`);

  await publishWorkerHeartbeat();
  heartbeatTimer = setInterval(() => {
    void publishWorkerHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
  console.log(`[Workers] Heartbeat published every ${HEARTBEAT_INTERVAL_MS / 1000}s`);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[Workers] Running. Press Ctrl+C to stop.");
}

void bootstrap().catch((error) => {
  console.error("[Workers] Failed to bootstrap:", error);
  process.exit(1);
});
