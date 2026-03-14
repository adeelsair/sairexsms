import IORedis from "ioredis";

const redisUrl = (process.env.REDIS_URL ?? "redis://127.0.0.1:6379").trim();

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export function createWorkerRedis() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
