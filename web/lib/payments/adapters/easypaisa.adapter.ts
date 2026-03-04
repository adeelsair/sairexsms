/**
 * EasyPaisa Payment Gateway Adapter
 *
 * Implements the PaymentGatewayAdapter interface for Telenor EasyPaisa.
 * Production integration requires merchant credentials configured in
 * OrganizationPaymentConfig.configJson.
 */
import { createHmac } from "crypto";
import type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
  GatewayConfig,
} from "../gateway.interface";

const SANDBOX_URL = "https://easypay.easypaisa.com.pk/tpg";
const PRODUCTION_URL = "https://easypay.easypaisa.com.pk/tpg";

export class EasypaisaAdapter implements PaymentGatewayAdapter {
  readonly gateway = "EASYPAISA" as const;

  constructor(private config: GatewayConfig) {}

  async createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionResult> {
    const baseUrl = this.config.sandbox ? SANDBOX_URL : PRODUCTION_URL;
    const orderId = `EP-${input.challanNo}-${Date.now()}`;

    const params = new URLSearchParams({
      storeId: this.config.merchantId ?? "",
      amount: input.amount.toFixed(2),
      postBackURL: input.callbackUrl,
      orderRefNum: orderId,
      expiryDate: this.getExpiryDate(),
      autoRedirect: "1",
      paymentMethod: "InitialRequest",
    });

    return {
      gatewayRef: orderId,
      redirectUrl: `${baseUrl}?${params.toString()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  verifyWebhook(
    payload: Record<string, unknown>,
    signature: string | null,
    _headers: Record<string, string>,
    _rawBody: string,
  ): boolean {
    if (!signature || !this.config.secretKey) return false;

    const data = [
      payload.amount,
      payload.orderRefNumber,
      payload.paymentToken,
      payload.storeId,
    ].join("");

    const expected = createHmac("sha256", this.config.secretKey)
      .update(data)
      .digest("hex");

    return expected === signature;
  }

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment {
    const responseCode = String(payload.responseCode ?? "");
    const isSuccess = responseCode === "0000";

    return {
      gatewayRef: String(payload.orderRefNumber ?? ""),
      amount: Number(payload.amount ?? 0),
      currency: "PKR",
      paidAt: payload.transactionDateTime
        ? new Date(payload.transactionDateTime as string)
        : new Date(),
      status: isSuccess ? "SUCCESS" : "FAILED",
      rawPayload: payload,
    };
  }

  private getExpiryDate(): string {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  }
}
