/**
 * Stripe Payment Gateway Adapter (Future)
 *
 * Skeleton implementation for Stripe Checkout Sessions.
 * Activate by adding Stripe credentials to OrganizationPaymentConfig.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
  GatewayConfig,
} from "../gateway.interface";

export class StripeAdapter implements PaymentGatewayAdapter {
  readonly gateway = "STRIPE" as const;

  constructor(private config: GatewayConfig) {}

  async createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionResult> {
    const sessionId = `stripe_cs_${Date.now()}`;

    return {
      gatewayRef: sessionId,
      redirectUrl: `https://checkout.stripe.com/pay/${sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      raw: {
        placeholder: true,
        message: "Stripe integration requires stripe npm package. This is a skeleton.",
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  verifyWebhook(
    _payload: Record<string, unknown>,
    signature: string | null,
    headers: Record<string, string>,
    rawBody: string,
  ): boolean {
    if (!signature || !this.config.webhookSecret) return false;

    const stripeSignature = headers["stripe-signature"] ?? signature;
    const parts = stripeSignature.split(",").reduce(
      (acc, part) => {
        const [key, val] = part.split("=");
        if (key === "t") acc.timestamp = val;
        if (key === "v1") acc.signature = val;
        return acc;
      },
      {} as { timestamp?: string; signature?: string },
    );

    if (!parts.timestamp || !parts.signature) return false;

    const signedPayload = `${parts.timestamp}.${rawBody}`;
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(parts.signature),
      );
    } catch {
      return false;
    }
  }

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment {
    const data = (payload.data as Record<string, unknown>) ?? {};
    const object = (data.object as Record<string, unknown>) ?? {};

    return {
      gatewayRef: String(object.id ?? payload.id ?? ""),
      amount: Number(object.amount_total ?? 0) / 100,
      currency: String(object.currency ?? "pkr").toUpperCase(),
      paidAt: new Date(),
      status: payload.type === "checkout.session.completed" ? "SUCCESS" : "FAILED",
      rawPayload: payload,
    };
  }
}
