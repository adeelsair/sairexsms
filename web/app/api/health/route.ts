/**
 * Health Check Endpoints
 *
 * GET /api/health       — Overall status
 * GET /api/health?check=db    — Database connectivity
 * GET /api/health?check=redis — Redis connectivity
 *
 * Used by load balancers, uptime monitors, and deployment pipelines.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { areWorkersStarted } from "@/lib/queue/workers";
import {
  resolveWorkerBootstrapMode,
  WORKER_HEARTBEAT_KEY,
} from "@/lib/queue/worker-runtime";

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  uptime: number;
  checks: Record<
    string,
    {
      status: "ok" | "down";
      latencyMs?: number;
      error?: string;
      details?: Record<string, unknown>;
    }
  >;
}

const startTime = Date.now();

async function checkDatabase(): Promise<{
  status: "ok" | "down";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<{
  status: "ok" | "down";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ok" : "down",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkWorkers(): Promise<{
  status: "ok" | "down";
  error?: string;
  details?: Record<string, unknown>;
}> {
  const mode = resolveWorkerBootstrapMode();

  if (mode === "in-process") {
    const started = areWorkersStarted();
    return started
      ? { status: "ok", details: { mode, started } }
      : {
          status: "down",
          error: "In-process worker mode is enabled but workers are not started",
          details: { mode, started },
        };
  }

  try {
    const redis = getRedisConnection();
    const heartbeat = await redis.get(WORKER_HEARTBEAT_KEY);
    if (!heartbeat) {
      return {
        status: "down",
        error: "External worker heartbeat missing",
        details: { mode, heartbeatKey: WORKER_HEARTBEAT_KEY },
      };
    }

    return {
      status: "ok",
      details: {
        mode,
        heartbeatKey: WORKER_HEARTBEAT_KEY,
        lastHeartbeatAt: heartbeat,
      },
    };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : "Failed to read worker heartbeat",
      details: { mode, heartbeatKey: WORKER_HEARTBEAT_KEY },
    };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const check = searchParams.get("check");

  const health: HealthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {},
  };

  const runDb = !check || check === "db";
  const runRedis = !check || check === "redis";
  const runWorkers = !check || check === "workers";

  if (runDb) {
    health.checks.database = await checkDatabase();
  }

  if (runRedis) {
    health.checks.redis = await checkRedis();
  }

  if (runWorkers) {
    health.checks.workers = await checkWorkers();
  }

  const anyDown = Object.values(health.checks).some((c) => c.status === "down");
  const allDown = Object.values(health.checks).every(
    (c) => c.status === "down",
  );

  if (allDown && Object.keys(health.checks).length > 0) {
    health.status = "down";
  } else if (anyDown) {
    health.status = "degraded";
  }

  const httpStatus = health.status === "down" ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}
