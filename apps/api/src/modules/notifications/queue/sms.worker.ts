import { Worker } from "bullmq"
import IORedis from "ioredis"
import { PrismaClient, SmsStatus } from "@prisma/client"
import { SmsService } from "../sms/sms.service"
import { SmsQueueJob } from "../sms/sms.types"
import { checkSmsRateLimit } from "./sms.rate-limit"

const queueName = process.env.SMS_QUEUE_NAME ?? "sms_queue"
const prisma = new PrismaClient()
const smsService = new SmsService()

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
})
const workerConcurrency = Number(process.env.SMS_WORKER_CONCURRENCY ?? "5")

async function markQueued(smsId: string): Promise<void> {
  const existing = await prisma.smsMessage.findUnique({ where: { id: smsId } })

  if (!existing) {
    throw new Error(`sms_messages row not found for id=${smsId}`)
  }

  if (existing.status === SmsStatus.PENDING) {
    await prisma.smsMessage.update({
      where: { id: smsId },
      data: { status: SmsStatus.QUEUED },
    })
  }
}

export const smsWorker = new Worker<SmsQueueJob>(
  queueName,
  async (job) => {
    if (job.name !== "send_sms") {
      throw new Error(`Unsupported job name: ${job.name}`)
    }

    const { smsId, to, message, tenantId } = job.data

    await markQueued(smsId)

    const limitResult = await checkSmsRateLimit({ tenantId, to })
    if (!limitResult.allowed) {
      const reason = limitResult.reason ?? "RATE_LIMITED"
      await prisma.smsMessage.update({
        where: { id: smsId },
        data: {
          status: SmsStatus.FAILED,
          provider: "rate_limiter",
          error: reason,
        },
      })

      throw new Error(reason)
    }

    const result = await smsService.router.send({ to, message, tenantId })

    if (result.success) {
      await prisma.smsMessage.update({
        where: { id: smsId },
        data: {
          status: SmsStatus.SENT,
          provider: result.provider,
          externalId: result.externalId,
          error: null,
          sentAt: new Date(),
        },
      })

      console.log(`[sms-worker] sent smsId=${smsId} provider=${result.provider}`)
      return
    }

    await prisma.smsMessage.update({
      where: { id: smsId },
      data: {
        status: SmsStatus.FAILED,
        provider: result.provider,
        error: result.error ?? "Unknown SMS send error",
      },
    })

    const failure = new Error(result.error ?? "Unknown SMS send error")
    console.error(`[sms-worker] failed smsId=${smsId} provider=${result.provider} error=${failure.message}`)
    throw failure
  },
  { connection, concurrency: workerConcurrency }
)

smsWorker.on("completed", (job) => {
  console.log(`[sms-worker] completed jobId=${job?.id ?? "unknown"} name=${job?.name ?? "unknown"}`)
})

smsWorker.on("failed", (job, err) => {
  console.error(
    `[sms-worker] failed jobId=${job?.id ?? "unknown"} name=${job?.name ?? "unknown"} error=${err.message}`
  )
})

console.log(`[sms-worker] started and listening on ${queueName}`)

async function shutdown(): Promise<void> {
  await smsWorker.close()
  await connection.quit()
  await prisma.$disconnect()
}

process.on("SIGINT", () => {
  shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})

process.on("SIGTERM", () => {
  shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})
