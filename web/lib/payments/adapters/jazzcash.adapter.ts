/**
 * JazzCash Payment Gateway Adapter
 *
 * Implements the PaymentGatewayAdapter interface for JazzCash.
 * Supports hosted checkout redirect flow.
 */
import { createHmac } from "crypto";
import type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
  GatewayConfig,
} from "../gateway.interface";

const SANDBOX_URL = "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform";
const PRODUCTION_URL = "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform";

export class JazzcashAdapter implements PaymentGatewayAdapter {
  readonly gateway = "JAZZCASH" as const;

  constructor(private config: GatewayConfig) {}

  async createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionResult> {
    const txnRefNo = `JC-${input.challanNo}-${Date.now()}`;
    const txnDateTime = this.formatDate(new Date());
    const expiryDateTime = this.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const hashInput = [
      this.config.secretKey ?? "",
      input.amount.toFixed(0),
      "PKR",
      txnDateTime,
      expiryDateTime,
      txnRefNo,
      this.config.merchantId ?? "",
      input.callbackUrl,
    ].join("&");

    const secureHash = createHmac("sha256", this.config.secretKey ?? "")
      .update(hashInput)
      .digest("hex");

    const baseUrl = this.config.sandbox ? SANDBOX_URL : PRODUCTION_URL;

    const params = new URLSearchParams({
      pp_Version: "1.1",
      pp_TxnType: "MWALLET",
      pp_Language: "EN",
      pp_MerchantID: this.config.merchantId ?? "",
      pp_Password: this.config.apiKey ?? "",
      pp_TxnRefNo: txnRefNo,
      pp_Amount: input.amount.toFixed(0),
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: txnDateTime,
      pp_TxnExpiryDateTime: expiryDateTime,
      pp_ReturnURL: input.callbackUrl,
      pp_Description: `Fee payment for ${input.studentName}`,
      pp_SecureHash: secureHash,
    });

    return {
      gatewayRef: txnRefNo,
      redirectUrl: `${baseUrl}?${params.toString()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  verifyWebhook(
    payload: Record<string, unknown>,
    signature: string | null,
    _headers: Record<string, string>,
    _rawBody: string,
  ): boolean {
    if (!signature || !this.config.secretKey) return false;

    const sorted = Object.keys(payload)
      .filter((k) => k.startsWith("pp_") && k !== "pp_SecureHash")
      .sort()
      .map((k) => String(payload[k]))
      .join("&");

    const expected = createHmac("sha256", this.config.secretKey)
      .update(`${this.config.secretKey}&${sorted}`)
      .digest("hex");

    return expected.toLowerCase() === signature.toLowerCase();
  }

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment {
    const responseCode = String(payload.pp_ResponseCode ?? "");
    const isSuccess = responseCode === "000";

    return {
      gatewayRef: String(payload.pp_TxnRefNo ?? ""),
      amount: Number(payload.pp_Amount ?? 0),
      currency: String(payload.pp_TxnCurrency ?? "PKR"),
      paidAt: payload.pp_TxnDateTime
        ? this.parseDate(String(payload.pp_TxnDateTime))
        : new Date(),
      status: isSuccess ? "SUCCESS" : "FAILED",
      rawPayload: payload,
    };
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  }

  private parseDate(s: string): Date {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10) - 1;
    const d = parseInt(s.slice(6, 8), 10);
    const h = parseInt(s.slice(8, 10), 10);
    const min = parseInt(s.slice(10, 12), 10);
    const sec = parseInt(s.slice(12, 14), 10);
    return new Date(y, m, d, h, min, sec);
  }
}
