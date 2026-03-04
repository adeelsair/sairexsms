/**
 * 1Bill Payment Gateway Adapter
 *
 * 1Bill is a bill aggregator common in Pakistan. Schools generate
 * challans with a bill reference; parents pay at any bank/ATM/wallet.
 * Reconciliation happens via periodic callbacks or API polling.
 */
import { createHmac } from "crypto";
import type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
  GatewayConfig,
} from "../gateway.interface";

export class OnebillAdapter implements PaymentGatewayAdapter {
  readonly gateway = "ONEBILL" as const;

  constructor(private config: GatewayConfig) {}

  async createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionResult> {
    const billRef = `1B-${input.challanNo}`;

    return {
      gatewayRef: billRef,
      redirectUrl: "",
      raw: {
        billRef,
        amount: input.amount,
        challanNo: input.challanNo,
        studentName: input.studentName,
        campusName: input.campusName,
        message: "1Bill payments are processed at bank counters, ATMs, or mobile wallets using the bill reference number.",
      },
    };
  }

  verifyWebhook(
    _payload: Record<string, unknown>,
    signature: string | null,
    _headers: Record<string, string>,
    rawBody: string,
  ): boolean {
    if (!signature || !this.config.webhookSecret) return false;

    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return expected === signature;
  }

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment {
    const status = String(payload.status ?? "").toUpperCase();

    return {
      gatewayRef: String(payload.billReference ?? payload.transactionId ?? ""),
      challanNo: String(payload.consumerNumber ?? ""),
      amount: Number(payload.amount ?? payload.transactionAmount ?? 0),
      currency: "PKR",
      paidAt: payload.transactionDate
        ? new Date(payload.transactionDate as string)
        : new Date(),
      status: status === "PAID" || status === "SUCCESS" ? "SUCCESS" : "FAILED",
      rawPayload: payload,
    };
  }
}
