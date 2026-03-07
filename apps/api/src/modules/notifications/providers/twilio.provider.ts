import { SmsProvider } from "./sms.provider.interface"
import { SmsSendParams, SmsSendResult } from "../sms/sms.types"

export class TwilioProvider implements SmsProvider {
  name = "twilio"

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    try {
      // placeholder until Twilio SDK integrated
      console.log("Sending SMS via Twilio", params)

      return {
        success: true,
        provider: this.name,
        externalId: "mock-id",
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"

      return {
        success: false,
        provider: this.name,
        error: message,
      }
    }
  }
}
