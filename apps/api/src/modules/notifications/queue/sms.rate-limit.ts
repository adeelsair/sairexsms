import IORedis from "ioredis"
import { getRedisConnectionOptions } from "./redis.config"

const redisOptions = getRedisConnectionOptions()

const redis = new IORedis({
  host: redisOptions.host,
  port: redisOptions.port,
  maxRetriesPerRequest: null,
})

const WINDOW_SEC = Number(process.env.SMS_RATE_LIMIT_WINDOW_SEC ?? "60")
const MAX_PER_TENANT = Number(process.env.SMS_RATE_LIMIT_MAX_PER_TENANT ?? "100")
const MAX_PER_RECIPIENT = Number(process.env.SMS_RATE_LIMIT_MAX_PER_RECIPIENT ?? "3")

function getWindowBucket(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SEC)
}

async function incrWithExpire(key: string): Promise<number> {
  const value = await redis.incr(key)
  if (value === 1) {
    await redis.expire(key, WINDOW_SEC)
  }
  return value
}

export async function checkSmsRateLimit(params: {
  tenantId: string
  to: string
}): Promise<{ allowed: boolean; reason?: string }> {
  const bucket = getWindowBucket()
  const tenantKey = `sms:rl:tenant:${params.tenantId}:${bucket}`
  const recipientKey = `sms:rl:recipient:${params.tenantId}:${params.to}:${bucket}`

  const tenantCount = await incrWithExpire(tenantKey)
  if (tenantCount > MAX_PER_TENANT) {
    return { allowed: false, reason: "TENANT_RATE_LIMIT" }
  }

  const recipientCount = await incrWithExpire(recipientKey)
  if (recipientCount > MAX_PER_RECIPIENT) {
    return { allowed: false, reason: "RECIPIENT_RATE_LIMIT" }
  }

  return { allowed: true }
}
