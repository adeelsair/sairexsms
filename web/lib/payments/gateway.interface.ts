/**
 * Payment Gateway Abstraction Layer — Interface
 *
 * All gateway adapters implement this contract. The payment service
 * resolves the correct adapter by gateway type and delegates to it.
 * This keeps the finance engine completely gateway-agnostic.
 */
import type { PaymentGateway } from "@/lib/generated/prisma";

/* ── Payment Session (redirect to gateway) ────────────── */

export interface CreateSessionInput {
  organizationId: string;
  challanId: number;
  challanNo: string;
  amount: number;
  currency: string;
  studentName: string;
  campusName: string;
  callbackUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentSessionResult {
  gatewayRef: string;
  redirectUrl: string;
  expiresAt?: Date;
  raw?: Record<string, unknown>;
}

/* ── Webhook Normalization ────────────────────────────── */

export interface NormalizedPayment {
  gatewayRef: string;
  challanId?: number;
  challanNo?: string;
  amount: number;
  currency: string;
  paidAt: Date;
  status: "SUCCESS" | "FAILED" | "PENDING";
  rawPayload: Record<string, unknown>;
}

/* ── Adapter Interface ────────────────────────────────── */

export interface PaymentGatewayAdapter {
  readonly gateway: PaymentGateway;

  createPaymentSession(input: CreateSessionInput): Promise<PaymentSessionResult>;

  verifyWebhook(
    payload: Record<string, unknown>,
    signature: string | null,
    headers: Record<string, string>,
    rawBody: string,
  ): boolean;

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment;
}

/* ── Gateway Config Shape ─────────────────────────────── */

export interface GatewayConfig {
  merchantId?: string;
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  [key: string]: unknown;
}
