import { SmsProvider } from "./sms.provider.interface"
import { SmsSendParams, SmsSendResult } from "../sms/sms.types"

export class ProviderRouter {
  constructor(private providers: SmsProvider[]) {}

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    for (const provider of this.providers) {
      const result = await provider.send(params)

      if (result.success) {
        return result
      }

      console.warn(`SMS provider ${provider.name} failed, trying next`)
    }

    return {
      success: false,
      provider: "none",
      error: "All SMS providers failed",
    }
  }
}
