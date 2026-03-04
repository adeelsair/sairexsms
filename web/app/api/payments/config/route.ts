import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  getPaymentConfig,
  savePaymentConfig,
  PaymentServiceError,
} from "@/lib/payments/payment.service";
import type { PaymentGateway } from "@/lib/generated/prisma";

/**
 * GET /api/payments/config
 *
 * Returns the payment gateway configuration for the organization.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId && !isSuperAdmin(guard)) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const config = await getPaymentConfig(orgId!);
    return NextResponse.json(config);
  } catch (err) {
    console.error("[Payment Config] Get error:", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

/**
 * POST /api/payments/config
 *
 * Save/update payment gateway configuration.
 *
 * Body: {
 *   primaryGateway: "EASYPAISA",
 *   enabledGateways: ["EASYPAISA", "JAZZCASH", "MANUAL"],
 *   config?: { EASYPAISA: { merchantId, apiKey, ... } }
 * }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { primaryGateway, enabledGateways, config: configJson } = body;

    if (!primaryGateway || !enabledGateways || !Array.isArray(enabledGateways)) {
      return NextResponse.json(
        { error: "primaryGateway and enabledGateways[] are required" },
        { status: 400 },
      );
    }

    const result = await savePaymentConfig({
      organizationId: orgId,
      primaryGateway: primaryGateway as PaymentGateway,
      enabledGateways: enabledGateways as PaymentGateway[],
      configJson,
    });

    return NextResponse.json({
      primaryGateway: result.primaryGateway,
      enabledGateways: result.enabledJson,
      isActive: result.isActive,
    });
  } catch (err) {
    if (err instanceof PaymentServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[Payment Config] Save error:", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
