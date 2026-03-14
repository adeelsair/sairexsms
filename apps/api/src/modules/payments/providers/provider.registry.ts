import { PaymentProvider } from "../payments.types";
import type { PaymentProviderInterface } from "./provider.interface";
import { OneBillProvider } from "./1bill.provider";
import { EasypaisaProvider } from "./easypaisa.provider";
import { JazzCashProvider } from "./jazzcash.provider";

export class ProviderRegistry {
  static get(provider: PaymentProvider): PaymentProviderInterface {
    switch (provider) {
      case PaymentProvider.ONEBILL:
        return new OneBillProvider();
      case PaymentProvider.EASYPAISA:
        return new EasypaisaProvider();
      case PaymentProvider.JAZZCASH:
        return new JazzCashProvider();
      default:
        throw new Error("Unsupported payment provider");
    }
  }
}

