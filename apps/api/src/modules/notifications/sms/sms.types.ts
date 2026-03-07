export type SmsSendParams = {
  to: string
  message: string
  tenantId: string
}

export type SmsSendResult = {
  success: boolean
  provider: string
  externalId?: string
  error?: string
}

export type SmsQueueJob = {
  smsId: string
  to: string
  message: string
  tenantId: string
}
