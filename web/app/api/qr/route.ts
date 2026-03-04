import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  generateQrToken,
  listQrTokens,
  QrTokenError,
} from "@/lib/adoption/qr-token.service";
import { emit } from "@/lib/events";

/**
 * GET /api/qr?type=...&referenceId=...&page=1&limit=50
 *
 * List QR tokens for the authenticated organization.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT");
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || undefined;
    const referenceId = url.searchParams.get("referenceId") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    const orgId = guard.organizationId;
    if (!orgId && !isSuperAdmin(guard)) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const result = await listQrTokens({
      organizationId: orgId!,
      type: type as Parameters<typeof listQrTokens>[0]["type"],
      referenceId,
      limit,
      offset: (page - 1) * limit,
    });

    return NextResponse.json({
      tokens: result.tokens,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("[QR List] Error:", err);
    return NextResponse.json({ error: "Failed to list QR tokens" }, { status: 500 });
  }
}

/**
 * POST /api/qr
 *
 * Generate a new QR token.
 *
 * Body: { type, referenceId, label?, ttlMs? }
 * Returns: { tokenId, url, expiresAt }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { type, referenceId, label, ttlMs, oneTimeUse, metadata } = body;

    if (!type || !referenceId) {
      return NextResponse.json(
        { error: "type and referenceId are required" },
        { status: 400 },
      );
    }

    const orgId = guard.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const result = await generateQrToken({
      organizationId: orgId,
      type,
      referenceId: String(referenceId),
      label,
      oneTimeUse,
      metadata,
      ttlMs,
      createdByUserId: guard.id,
    });

    emit("QrTokenGenerated", orgId, {
      tokenId: result.tokenId,
      type,
      referenceId: String(referenceId),
    }, guard.id).catch(() => {});

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof QrTokenError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[QR Generate] Error:", err);
    return NextResponse.json({ error: "Failed to generate QR token" }, { status: 500 });
  }
}
