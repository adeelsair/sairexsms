import * as Sentry from "@sentry/nextjs";
import { resolveWorkerBootstrapMode } from "@/lib/queue/worker-runtime";

/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Runs once when the Next.js server starts. We use this to:
 *  1. Initialize Sentry for error tracking
 *  2. Boot background workers in-process during development
 *     (in production, workers should run as a separate process)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    const configuredMode = (process.env.WORKER_BOOTSTRAP_MODE ?? "").trim().toLowerCase();
    if (
      process.env.NODE_ENV === "production" &&
      configuredMode &&
      configuredMode !== "in-process" &&
      configuredMode !== "external"
    ) {
      const err = new Error(
        `Invalid WORKER_BOOTSTRAP_MODE="${process.env.WORKER_BOOTSTRAP_MODE}". Expected "in-process" or "external".`,
      );
      console.error("[Workers] Invalid bootstrap mode", {
        configuredMode: process.env.WORKER_BOOTSTRAP_MODE,
        nodeEnv: process.env.NODE_ENV,
      });
      Sentry.captureException(err);
      throw err;
    }

    const mode = resolveWorkerBootstrapMode();
    if (mode === "external") {
      console.info("[Workers] External mode active — app process will not bootstrap workers", {
        mode,
        nodeEnv: process.env.NODE_ENV,
      });
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      const err = new Error("WORKER_BOOTSTRAP_MODE=in-process requires REDIS_URL");
      console.error("[Workers] Redis is required for in-process worker bootstrap", {
        mode,
        nodeEnv: process.env.NODE_ENV,
      });
      Sentry.captureException(err);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
      return;
    }

    try {
      const { startWorkers } = await import("./lib/queue/workers");
      startWorkers();
    } catch (err) {
      console.error("[Workers] Failed to start:", err);
      Sentry.captureException(err);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
