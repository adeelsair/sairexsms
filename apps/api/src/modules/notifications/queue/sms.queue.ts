import { Queue } from "bullmq"
import IORedis from "ioredis"

const queueName = process.env.SMS_QUEUE_NAME ?? "sms_queue"

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
})

export const smsQueue = new Queue(queueName, {
  connection,
})
