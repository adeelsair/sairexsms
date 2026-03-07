import { TwilioProvider } from "../providers/twilio.provider"
import { ProviderRouter } from "../providers/provider.router"
import { smsQueue } from "../queue/sms.queue"
import { SmsQueueJob, SmsSendParams, SmsSendResult } from "./sms.types"
import { PrismaClient, SmsStatus } from "../../../../../../web/lib/generated/prisma"

export class SmsService {
  // Future order: Jazz -> Zong -> Telenor -> Twilio
  private readonly providers = [new TwilioProvider()]
  readonly router = new ProviderRouter(this.providers)
  private readonly prisma = new PrismaClient()

  async enqueueSms(job: SmsQueueJob): Promise<void> {
    await smsQueue.add("send_sms", job, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    })
  }

  async sendViaProviders(params: SmsSendParams): Promise<SmsSendResult> {
    return this.router.send(params)
  }

  async queueSms(params: SmsSendParams): Promise<{ smsId: string; queued: boolean }> {
    const smsRecord = await this.prisma.smsMessage.create({
      data: {
        tenantId: params.tenantId,
        recipient: params.to,
        message: params.message,
        status: SmsStatus.PENDING,
      },
      select: { id: true },
    })

    const job: SmsQueueJob = {
      smsId: smsRecord.id,
      to: params.to,
      message: params.message,
      tenantId: params.tenantId,
    }

    try {
      await this.enqueueSms(job)
      return { smsId: smsRecord.id, queued: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to enqueue SMS job"

      await this.prisma.smsMessage.update({
        where: { id: smsRecord.id },
        data: {
          status: SmsStatus.FAILED,
          error: message,
        },
      })

      throw new Error(message)
    }
  }
}
