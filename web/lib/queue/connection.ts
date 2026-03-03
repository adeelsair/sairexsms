import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis & ConnectionOptions {
  if (connection) return connection as unknown as IORedis & ConnectionOptions;

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });

  connection.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  return connection as unknown as IORedis & ConnectionOptions;
}
