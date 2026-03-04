import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import {
  initiatePayment,
  PaymentServiceError,
} from "@/lib/payments/payment.service";
import { emit } from "@/lib/events";

/**
 * POST /api/payments/initiate
 *
 * Initiates a payment session with the configured gateway.
 * Creates a PENDING PaymentRecord and returns a redirect URL.
 *
 * Body: { challanId, gateway?, callbackUrl, cancelUrl? }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(
    guard,
    "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT", "STAFF", "PARENT",
  );
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId && !isSuperAdmin(guard)) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const auditActor = resolveAuditActor(guard);
    const body = await request.json();
    const { challanId, gateway, callbackUrl, cancelUrl } = body;

    if (!challanId || !callbackUrl) {
      return NextResponse.json(
        { error: "challanId and callbackUrl are required" },
        { status: 400 },
      );
    }

    const result = await initiatePayment({
      organizationId: orgId!,
      challanId: Number(challanId),
      gateway,
      callbackUrl,
      cancelUrl,
      initiatedByUserId: guard.id,
      auditActor,
    });

    emit("PaymentInitiated", orgId!, {
      paymentRecordId: result.paymentRecordId,
      challanId: Number(challanId),
      gateway: result.gateway,
      gatewayRef: result.gatewayRef,
      amount: 0,
    }, auditActor).catch(() => {});

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PaymentServiceError) {
      const statusMap: Record<string, number> = {
        CHALLAN_NOT_FOUND: 404,
        CHALLAN_ALREADY_PAID: 409,
        GATEWAY_NOT_CONFIGURED: 400,
        GATEWAY_NOT_ENABLED: 400,
      };
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 500 },
      );
    }
    console.error("[Payment Initiate] Error:", err);
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}
