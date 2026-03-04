/**
 * Payment Service — Gateway Orchestration Layer
 *
 * Resolves the correct gateway adapter, initiates payment sessions,
 * processes webhook callbacks, and delegates to the existing
 * reconciliation engine. No finance logic is duplicated here.
 */
import { prisma } from "@/lib/prisma";
import type { AuditActorContext } from "@/lib/audit/resolve-audit-actor";
import type { PaymentGateway, Prisma } from "@/lib/generated/prisma";
import { emit } from "@/lib/events";
import type {
  PaymentGatewayAdapter,
  GatewayConfig,
  NormalizedPayment,
  PaymentSessionResult,
} from "./gateway.interface";
import { ManualAdapter } from "./adapters/manual.adapter";
import { EasypaisaAdapter } from "./adapters/easypaisa.adapter";
import { JazzcashAdapter } from "./adapters/jazzcash.adapter";
import { OnebillAdapter } from "./adapters/onebill.adapter";
import { StripeAdapter } from "./adapters/stripe.adapter";

/* ── Errors ────────────────────────────────────────────── */

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "GATEWAY_NOT_CONFIGURED"
      | "GATEWAY_NOT_ENABLED"
      | "CHALLAN_NOT_FOUND"
      | "CHALLAN_ALREADY_PAID"
      | "WEBHOOK_VERIFICATION_FAILED"
      | "DUPLICATE_PAYMENT"
      | "PROCESSING_FAILED" = "PROCESSING_FAILED",
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

/* ── Adapter Factory ──────────────────────────────────── */

function createAdapter(
  gateway: PaymentGateway,
  config: GatewayConfig,
): PaymentGatewayAdapter {
  switch (gateway) {
    case "EASYPAISA":
      return new EasypaisaAdapter(config);
    case "JAZZCASH":
      return new JazzcashAdapter(config);
    case "ONEBILL":
      return new OnebillAdapter(config);
    case "STRIPE":
      return new StripeAdapter(config);
    case "MANUAL":
      return new ManualAdapter();
    default:
      throw new PaymentServiceError(
        `Unknown gateway: ${gateway}`,
        "GATEWAY_NOT_CONFIGURED",
      );
  }
}

/* ── Resolve Adapter for Organization ─────────────────── */

export async function resolveGatewayAdapter(
  organizationId: string,
  gateway?: PaymentGateway,
): Promise<{ adapter: PaymentGatewayAdapter; gateway: PaymentGateway }> {
  const config = await prisma.organizationPaymentConfig.findUnique({
    where: { organizationId },
  });

  const targetGateway = gateway ?? config?.primaryGateway ?? "MANUAL";

  if (targetGateway !== "MANUAL") {
    if (!config || !config.isActive) {
      throw new PaymentServiceError(
        "Payment gateway not configured for this organization",
        "GATEWAY_NOT_CONFIGURED",
      );
    }

    const enabled = (config.enabledJson as string[]) ?? [];
    if (!enabled.includes(targetGateway)) {
      throw new PaymentServiceError(
        `Gateway ${targetGateway} is not enabled`,
        "GATEWAY_NOT_ENABLED",
      );
    }
  }

  const gatewayConfigs = (config?.configJson as Record<string, GatewayConfig>) ?? {};
  const gwConfig = gatewayConfigs[targetGateway] ?? {};

  return {
    adapter: createAdapter(targetGateway, gwConfig),
    gateway: targetGateway,
  };
}

/* ── Initiate Payment ─────────────────────────────────── */

export interface InitiatePaymentInput {
  organizationId: string;
  challanId: number;
  gateway?: PaymentGateway;
  callbackUrl: string;
  cancelUrl?: string;
  initiatedByUserId?: number;
  auditActor?: AuditActorContext;
}

export interface InitiatePaymentResult {
  paymentRecordId: string;
  gatewayRef: string;
  redirectUrl: string;
  expiresAt?: Date;
  gateway: PaymentGateway;
}

export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  const challan = await prisma.feeChallan.findUnique({
    where: { id: input.challanId },
    include: {
      student: { select: { fullName: true } },
      campus: { select: { name: true } },
      bankAccount: { select: { id: true } },
    },
  });

  if (!challan) {
    throw new PaymentServiceError("Challan not found", "CHALLAN_NOT_FOUND");
  }

  if (challan.organizationId !== input.organizationId) {
    throw new PaymentServiceError("Challan not found", "CHALLAN_NOT_FOUND");
  }

  if (challan.status === "PAID") {
    throw new PaymentServiceError(
      "This challan has already been paid",
      "CHALLAN_ALREADY_PAID",
    );
  }

  const outstanding = Number(challan.totalAmount) - Number(challan.paidAmount);

  const { adapter, gateway } = await resolveGatewayAdapter(
    input.organizationId,
    input.gateway,
  );

  const session: PaymentSessionResult = await adapter.createPaymentSession({
    organizationId: input.organizationId,
    challanId: challan.id,
    challanNo: challan.challanNo,
    amount: outstanding,
    currency: "PKR",
    studentName: challan.student?.fullName ?? "Student",
    campusName: challan.campus?.name ?? "Campus",
    callbackUrl: input.callbackUrl,
    cancelUrl: input.cancelUrl,
  });

  const paymentRecord = await prisma.paymentRecord.create({
    data: {
      organizationId: input.organizationId,
      bankAccountId: challan.bankAccount?.id,
      challanId: challan.id,
      amount: outstanding,
      currency: "PKR",
      paymentChannel: "ONLINE_GATEWAY",
      gateway,
      gatewayRef: session.gatewayRef,
      status: "PENDING",
    },
  });

  emit("PaymentReceived", input.organizationId, {
    paymentRecordId: paymentRecord.id,
    bankAccountId: challan.bankAccount?.id,
    amount: outstanding,
    transactionRef: session.gatewayRef,
    paymentChannel: "ONLINE_GATEWAY",
  }, input.auditActor ?? input.initiatedByUserId).catch(() => {});

  return {
    paymentRecordId: paymentRecord.id,
    gatewayRef: session.gatewayRef,
    redirectUrl: session.redirectUrl,
    expiresAt: session.expiresAt,
    gateway,
  };
}

/* ── Process Webhook ──────────────────────────────────── */

export interface ProcessWebhookInput {
  gateway: PaymentGateway;
  payload: Record<string, unknown>;
  rawBody: string;
  signature: string | null;
  headers: Record<string, string>;
}

export interface ProcessWebhookResult {
  paymentRecordId: string;
  status: "RECONCILED" | "FAILED" | "DUPLICATE";
  normalized: NormalizedPayment;
}

export async function processWebhook(
  input: ProcessWebhookInput,
): Promise<ProcessWebhookResult> {
  const { adapter } = await resolveGatewayAdapterByType(
    input.gateway,
    input.payload,
    input.signature,
    input.headers,
    input.rawBody,
  );

  const signatureValid = adapter.verifyWebhook(
    input.payload,
    input.signature,
    input.headers,
    input.rawBody,
  );

  if (!signatureValid && input.gateway !== "MANUAL") {
    throw new PaymentServiceError(
      "Webhook signature verification failed",
      "WEBHOOK_VERIFICATION_FAILED",
    );
  }

  const normalized = adapter.normalizeWebhook(input.payload);
  const gatewayPayloadJson = normalized.rawPayload as unknown as Prisma.InputJsonValue;

  const existing = await prisma.paymentRecord.findFirst({
    where: {
      gateway: input.gateway,
      gatewayRef: normalized.gatewayRef,
      status: "RECONCILED",
    },
  });

  if (existing) {
    return {
      paymentRecordId: existing.id,
      status: "DUPLICATE",
      normalized,
    };
  }

  if (normalized.status !== "SUCCESS") {
    const failedRecord = await prisma.paymentRecord.findFirst({
      where: { gateway: input.gateway, gatewayRef: normalized.gatewayRef },
    });

    if (failedRecord) {
      await prisma.paymentRecord.update({
        where: { id: failedRecord.id },
        data: {
          status: "FAILED",
          gatewayPayload: gatewayPayloadJson,
        },
      });

      return {
        paymentRecordId: failedRecord.id,
        status: "FAILED",
        normalized,
      };
    }

    return {
      paymentRecordId: "",
      status: "FAILED",
      normalized,
    };
  }

  let paymentRecord = await prisma.paymentRecord.findFirst({
    where: { gateway: input.gateway, gatewayRef: normalized.gatewayRef },
  });

  if (paymentRecord) {
    paymentRecord = await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        paidAt: normalized.paidAt,
        gatewayPayload: gatewayPayloadJson,
        status: "PENDING",
      },
    });
  }

  if (!paymentRecord) {
    const challanId = normalized.challanId ?? await resolveChallanFromRef(normalized);

    paymentRecord = await prisma.paymentRecord.create({
      data: {
        organizationId: "",
        amount: normalized.amount,
        currency: normalized.currency,
        paymentChannel: "ONLINE_GATEWAY",
        gateway: input.gateway,
        gatewayRef: normalized.gatewayRef,
        gatewayPayload: gatewayPayloadJson,
        paidAt: normalized.paidAt,
        challanId,
        status: "PENDING",
      },
    });
  }

  if (paymentRecord.challanId) {
    const { reconcilePayment } = await import("@/lib/finance/reconciliation.service");

    const challan = await prisma.feeChallan.findUnique({
      where: { id: paymentRecord.challanId },
      select: { organizationId: true },
    });

    if (challan) {
      if (!paymentRecord.organizationId) {
        await prisma.paymentRecord.update({
          where: { id: paymentRecord.id },
          data: { organizationId: challan.organizationId },
        });
      }

      await reconcilePayment({
        paymentRecordId: paymentRecord.id,
        challanId: paymentRecord.challanId,
        organizationId: challan.organizationId,
      });
    }
  }

  return {
    paymentRecordId: paymentRecord.id,
    status: "RECONCILED",
    normalized,
  };
}

/* ── Helpers ───────────────────────────────────────────── */

async function resolveGatewayAdapterByType(
  gateway: PaymentGateway,
  payload: Record<string, unknown>,
  signature: string | null,
  headers: Record<string, string>,
  rawBody: string,
): Promise<{ adapter: PaymentGatewayAdapter }> {
  if (gateway === "MANUAL") {
    return { adapter: createAdapter(gateway, {}) };
  }

  const gatewayRef = extractGatewayRef(gateway, payload);
  if (gatewayRef) {
    const record = await prisma.paymentRecord.findFirst({
      where: { gateway, gatewayRef },
      select: { organizationId: true },
    });

    if (record?.organizationId) {
      const orgConfig = await prisma.organizationPaymentConfig.findUnique({
        where: { organizationId: record.organizationId },
        select: {
          isActive: true,
          enabledJson: true,
          configJson: true,
        },
      });
      if (orgConfig?.isActive) {
        const enabled = (orgConfig.enabledJson as string[] | null) ?? [];
        if (enabled.includes(gateway)) {
          const configMap =
            (orgConfig.configJson as Record<string, GatewayConfig> | null) ?? {};
          const adapter = createAdapter(gateway, configMap[gateway] ?? {});
          return { adapter };
        }
      }
    }
  }

  const activeConfigs = await prisma.organizationPaymentConfig.findMany({
    where: { isActive: true },
    select: {
      enabledJson: true,
      configJson: true,
    },
  });

  for (const configRow of activeConfigs) {
    const enabled = (configRow.enabledJson as string[] | null) ?? [];
    if (!enabled.includes(gateway)) continue;

    const configMap =
      (configRow.configJson as Record<string, GatewayConfig> | null) ?? {};
    const candidate = createAdapter(gateway, configMap[gateway] ?? {});
    if (candidate.verifyWebhook(payload, signature, headers, rawBody)) {
      return { adapter: candidate };
    }
  }

  throw new PaymentServiceError(
    `No active configuration found for ${gateway}`,
    "GATEWAY_NOT_CONFIGURED",
  );
}

function extractGatewayRef(
  gateway: PaymentGateway,
  payload: Record<string, unknown>,
): string | null {
  if (gateway === "STRIPE") {
    const data = (payload.data as Record<string, unknown> | undefined) ?? {};
    const object = (data.object as Record<string, unknown> | undefined) ?? {};
    return String(object.id ?? payload.id ?? "").trim() || null;
  }
  if (gateway === "JAZZCASH") {
    return String(payload.pp_TxnRefNo ?? "").trim() || null;
  }
  if (gateway === "EASYPAISA") {
    return String(payload.orderRefNumber ?? payload.orderRefNum ?? "").trim() || null;
  }
  if (gateway === "ONEBILL") {
    return String(payload.billReference ?? payload.transactionId ?? "").trim() || null;
  }
  return null;
}

async function resolveChallanFromRef(
  normalized: NormalizedPayment,
): Promise<number | null> {
  if (normalized.challanNo) {
    const challan = await prisma.feeChallan.findFirst({
      where: { challanNo: normalized.challanNo },
      select: { id: true },
    });
    return challan?.id ?? null;
  }
  return null;
}

/* ── Get Org Payment Config ───────────────────────────── */

export async function getPaymentConfig(organizationId: string) {
  const config = await prisma.organizationPaymentConfig.findUnique({
    where: { organizationId },
  });

  if (!config) {
    return {
      primaryGateway: "MANUAL" as PaymentGateway,
      enabledGateways: ["MANUAL"] as string[],
      isActive: false,
    };
  }

  return {
    primaryGateway: config.primaryGateway,
    enabledGateways: (config.enabledJson as string[]) ?? [],
    isActive: config.isActive,
  };
}

/* ── Save Org Payment Config ──────────────────────────── */

export interface SavePaymentConfigInput {
  organizationId: string;
  primaryGateway: PaymentGateway;
  enabledGateways: PaymentGateway[];
  configJson?: Record<string, GatewayConfig>;
}

export async function savePaymentConfig(
  input: SavePaymentConfigInput,
) {
  const configJson = (input.configJson ?? {}) as unknown as Prisma.InputJsonValue;

  return prisma.organizationPaymentConfig.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      primaryGateway: input.primaryGateway,
      enabledJson: input.enabledGateways,
      configJson,
      isActive: true,
    },
    update: {
      primaryGateway: input.primaryGateway,
      enabledJson: input.enabledGateways,
      configJson,
      isActive: true,
    },
  });
}
