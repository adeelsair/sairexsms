import { NextResponse } from "next/server";
import { z } from "zod";

import {
  claimQRInvite,
  QRInviteError,
} from "@/lib/adoption/qr-invite.service";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  issueSessionForUserId,
} from "@/lib/auth/session-issuer";

const claimInviteSchema = z.object({
  token: z.string().min(1),
  otpSessionId: z.string().min(1),
  code: z.string().min(4),
  studentId: z.number().int().positive().optional(),
  admissionNo: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "invite:claim", RATE_LIMITS.OTP_VERIFY);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const parsed = claimInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await claimQRInvite({
      tokenId: parsed.data.token,
      otpSessionId: parsed.data.otpSessionId,
      code: parsed.data.code,
      studentId: parsed.data.studentId,
      admissionNo: parsed.data.admissionNo,
    });

    const issued = await issueSessionForUserId(result.userId);
    if (!issued) {
      return NextResponse.json(
        { error: "Joined but could not create session" },
        { status: 500 },
      );
    }

    const response = NextResponse.json(result, { status: 201 });
    attachSessionCookie(response, issued.sessionToken, issued.expires);
    return response;
  } catch (error) {
    if (error instanceof QRInviteError) {
      const statusByCode: Record<string, number> = {
        NOT_FOUND: 404,
        EXPIRED: 410,
        LIMIT_REACHED: 410,
        OTP_INVALID: 401,
        STUDENT_REQUIRED: 400,
        STUDENT_NOT_FOUND: 404,
        INVALID_ROLE: 400,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error("[Invite Claim] Failed:", error);
    return NextResponse.json({ error: "Failed to claim invite" }, { status: 500 });
  }
}
