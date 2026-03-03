import { NextResponse } from "next/server";
import { verifyOtp, OtpError } from "@/lib/adoption/otp.service";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/events";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/phone/verify
 *
 * Step 2 of passwordless login: verify OTP and return user + memberships.
 * Session creation is handled by downstream join/claim flow.
 *
 * Body: { otpSessionId: string, code: string }
 * Returns: { success, userId, isNewUser, memberships }
 */
export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:phone-verify", RATE_LIMITS.OTP_VERIFY);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { otpSessionId, code } = body;

    if (!otpSessionId || !code) {
      return NextResponse.json(
        { error: "otpSessionId and code are required" },
        { status: 400 },
      );
    }

    const result = await verifyOtp({ otpSessionId, code });

    const memberships = await prisma.membership.findMany({
      where: { userId: result.userId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        organizationId: true,
        campusId: true,
        unitPath: true,
        organization: {
          select: {
            organizationName: true,
            organizationStructure: true,
          },
        },
      },
    });

    emit("PhoneLoginCompleted", memberships[0]?.organizationId ?? "", {
      userId: result.userId,
      phone: result.phone,
      isNewUser: result.isNewUser,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      userId: result.userId,
      phone: result.phone,
      isNewUser: result.isNewUser,
      memberships: memberships.map((m) => ({
        id: m.id,
        role: m.role,
        organizationId: m.organizationId,
        campusId: m.campusId,
        organizationName: m.organization.organizationName,
      })),
    });
  } catch (err) {
    if (err instanceof OtpError) {
      const statusMap: Record<string, number> = {
        RATE_LIMITED: 429,
        TOO_MANY_ATTEMPTS: 429,
        EXPIRED: 410,
        CONSUMED: 410,
        NOT_FOUND: 404,
        INVALID: 401,
      };
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 400 },
      );
    }
    console.error("[Auth Phone Verify] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
