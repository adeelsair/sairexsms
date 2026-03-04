import { NextResponse } from "next/server";

import {
  QRInviteError,
  resolveQRInviteToken,
} from "@/lib/adoption/qr-invite.service";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const blocked = applyRateLimit(request, "invite:resolve", RATE_LIMITS.QR_RESOLVE);
  if (blocked) return blocked;

  try {
    const url = new URL(request.url);
    const tokenId = url.searchParams.get("token");
    if (!tokenId) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const invite = await resolveQRInviteToken(tokenId);
    const metadata = invite.metadata ?? {};
    const studentId = metadata.studentId;

    const prefilledStudent = typeof studentId === "number"
      ? await prisma.student.findFirst({
          where: {
            id: studentId,
            organizationId: invite.organizationId,
          },
          select: {
            id: true,
            fullName: true,
            admissionNo: true,
          },
        })
      : null;

    return NextResponse.json({
      tokenId: invite.id,
      role: invite.role,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      hasPrefilledStudent: Boolean(prefilledStudent),
      prefilledStudent,
    });
  } catch (error) {
    if (error instanceof QRInviteError) {
      const statusByCode: Record<string, number> = {
        NOT_FOUND: 404,
        EXPIRED: 410,
        LIMIT_REACHED: 410,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error("[Invite Resolve] Failed:", error);
    return NextResponse.json({ error: "Failed to resolve invite" }, { status: 500 });
  }
}
