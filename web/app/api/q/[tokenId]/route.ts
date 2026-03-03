import { NextResponse } from "next/server";
import {
  resolveQrToken,
  resolveFeePaymentQr,
  resolveParentAccessQr,
  QrTokenError,
} from "@/lib/adoption/qr-token.service";
import { emit } from "@/lib/events";

/**
 * GET /api/q/:tokenId
 *
 * Public endpoint — resolves a QR token to its underlying entity.
 * No auth required (the token IS the credential).
 * Tenant isolation enforced by the token's organizationId.
 *
 * Returns different shapes depending on token type:
 *   FEE_PAYMENT   → challan details + bank info (re-scannable)
 *   PARENT_ACCESS → student details + org context (one-time)
 *   ADMISSION     → organization info for form
 *   ATTENDANCE    → section info for marking
 *   LOGIN         → session bootstrap data (one-time)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await params;

    const token = await resolveQrToken(tokenId);

    emit("QrTokenResolved", token.organizationId, {
      tokenId: token.tokenId,
      type: token.type,
      referenceId: token.referenceId,
    }).catch(() => {});

    if (token.type === "FEE_PAYMENT") {
      const data = await resolveFeePaymentQr(tokenId);
      return NextResponse.json({
        type: "FEE_PAYMENT",
        oneTimeUse: token.oneTimeUse,
        ...data.challan,
      });
    }

    if (token.type === "PARENT_ACCESS") {
      const data = await resolveParentAccessQr(tokenId);
      return NextResponse.json({
        type: "PARENT_ACCESS",
        organizationId: token.organizationId,
        tokenId: token.tokenId,
        oneTimeUse: token.oneTimeUse,
        student: data.student,
      });
    }

    if (token.type === "ADMISSION") {
      const { prisma } = await import("@/lib/prisma");
      const org = await prisma.organization.findUnique({
        where: { id: token.organizationId },
        select: {
          id: true,
          organizationName: true,
          slug: true,
        },
      });

      return NextResponse.json({
        type: "ADMISSION",
        organizationId: token.organizationId,
        oneTimeUse: token.oneTimeUse,
        organization: org,
        referenceId: token.referenceId,
      });
    }

    if (token.type === "ATTENDANCE") {
      const { prisma } = await import("@/lib/prisma");
      const section = await prisma.section.findUnique({
        where: { id: token.referenceId },
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
          campus: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        type: "ATTENDANCE",
        organizationId: token.organizationId,
        oneTimeUse: token.oneTimeUse,
        section,
      });
    }

    if (token.type === "LOGIN") {
      return NextResponse.json({
        type: "LOGIN",
        organizationId: token.organizationId,
        tokenId: token.tokenId,
        oneTimeUse: token.oneTimeUse,
        referenceId: token.referenceId,
        metadata: token.metadata,
      });
    }

    return NextResponse.json({
      type: token.type,
      organizationId: token.organizationId,
      oneTimeUse: token.oneTimeUse,
      referenceId: token.referenceId,
    });
  } catch (err) {
    if (err instanceof QrTokenError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        EXPIRED: 410,
        CONSUMED: 410,
        TENANT_MISMATCH: 403,
        INVALID_TYPE: 400,
      };
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 400 },
      );
    }
    console.error("[QR Resolve] Error:", err);
    return NextResponse.json({ error: "Failed to resolve QR code" }, { status: 500 });
  }
}
