import { SmsService } from "./sms.service"
import { SmsSendParams } from "./sms.types"

type QueueSmsSuccess = {
  ok: true
  smsId: string
  queued: boolean
}

type QueueSmsFailure = {
  ok: false
  error: string
}

type QueueSmsApiResponse = {
  status: number
  body: QueueSmsSuccess | QueueSmsFailure
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function validateQueueSmsBody(body: unknown): { ok: true; data: SmsSendParams } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body" }
  }

  const raw = body as Record<string, unknown>
  const to = raw.to
  const message = raw.message
  const tenantId = raw.tenantId

  if (!isNonEmptyString(to)) {
    return { ok: false, error: "Field 'to' is required" }
  }

  if (!isNonEmptyString(message)) {
    return { ok: false, error: "Field 'message' is required" }
  }

  if (!isNonEmptyString(tenantId)) {
    return { ok: false, error: "Field 'tenantId' is required" }
  }

  return {
    ok: true,
    data: {
      to: to.trim(),
      message: message.trim(),
      tenantId: tenantId.trim(),
    },
  }
}

const smsService = new SmsService()

export async function handleQueueSmsRequest(body: unknown): Promise<QueueSmsApiResponse> {
  const validation = validateQueueSmsBody(body)

  if (!validation.ok) {
    return {
      status: 400,
      body: {
        ok: false,
        error: validation.error,
      },
    }
  }

  try {
    const result = await smsService.queueSms(validation.data)

    return {
      status: 202,
      body: {
        ok: true,
        smsId: result.smsId,
        queued: result.queued,
      },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to queue SMS"

    return {
      status: 500,
      body: {
        ok: false,
        error: message,
      },
    }
  }
}
