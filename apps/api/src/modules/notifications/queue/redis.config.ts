type RedisConnectionOptions = {
  host: string
  port: number
}

function parseRedisUrl(redisUrl: string): RedisConnectionOptions | null {
  try {
    const parsed = new URL(redisUrl)
    const port = Number(parsed.port || "6379")
    return {
      host: parsed.hostname,
      port: Number.isFinite(port) ? port : 6379,
    }
  } catch {
    return null
  }
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    const parsed = parseRedisUrl(redisUrl)
    if (parsed) {
      return parsed
    }
  }

  return {
    host: process.env.REDIS_HOST ?? "redis",
    port: Number(process.env.REDIS_PORT ?? "6379"),
  }
}
