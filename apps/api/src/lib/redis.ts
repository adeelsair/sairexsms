import IORedis from "ioredis";

const redisUrl = (process.env.REDIS_URL ?? "redis://127.0.0.1:6379").trim();

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.warn("[Payment API] Redis connection issue:", err.message);
});

export function createWorkerRedis() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
