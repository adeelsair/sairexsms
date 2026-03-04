/**
 * Manual Payment Adapter
 *
 * Used for OTC/bank deposit/cash payments entered by admin.
 * Does not redirect to any external gateway.
 */
import type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
} from "../gateway.interface";

export class ManualAdapter implements PaymentGatewayAdapter {
  readonly gateway = "MANUAL" as const;

  async createPaymentSession(_input: CreateSessionInput): Promise<PaymentSessionResult> {
    throw new Error("Manual payments do not use gateway sessions");
  }

  verifyWebhook(
    _payload: Record<string, unknown>,
    _signature: string | null,
    _headers: Record<string, string>,
    _rawBody: string,
  ): boolean {
    return false;
  }

  normalizeWebhook(payload: Record<string, unknown>): NormalizedPayment {
    return {
      gatewayRef: (payload.transactionRef as string) ?? `MANUAL-${Date.now()}`,
      challanId: payload.challanId as number | undefined,
      amount: Number(payload.amount ?? 0),
      currency: (payload.currency as string) ?? "PKR",
      paidAt: payload.paidAt ? new Date(payload.paidAt as string) : new Date(),
      status: "SUCCESS",
      rawPayload: payload,
    };
  }
}
