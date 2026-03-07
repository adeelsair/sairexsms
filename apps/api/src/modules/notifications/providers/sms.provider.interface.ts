import { SmsSendParams, SmsSendResult } from "../sms/sms.types"

export interface SmsProvider {
  name: string

  send(params: SmsSendParams): Promise<SmsSendResult>
}
