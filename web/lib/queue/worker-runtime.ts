export type WorkerBootstrapMode = "in-process" | "external";

export const WORKER_HEARTBEAT_KEY = "sairex:workers:heartbeat";
export const WORKER_HEARTBEAT_TTL_SECONDS = 90;

export function resolveWorkerBootstrapMode(): WorkerBootstrapMode {
  const configured = (process.env.WORKER_BOOTSTRAP_MODE ?? "").trim().toLowerCase();
  if (configured === "in-process" || configured === "external") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "external" : "in-process";
}

