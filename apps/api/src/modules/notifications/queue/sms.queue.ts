import { Queue } from "bullmq"
import IORedis from "ioredis"
import { getRedisConnectionOptions } from "./redis.config"

const queueName = process.env.SMS_QUEUE_NAME ?? "sms_queue"
const redisOptions = getRedisConnectionOptions()

const connection = new IORedis({
  host: redisOptions.host,
  port: redisOptions.port,
  maxRetriesPerRequest: null,
})

export const smsQueue = new Queue(queueName, {
  connection,
})
