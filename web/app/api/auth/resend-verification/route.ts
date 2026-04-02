import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { resendVerificationSchema } from "@/lib/validations/resend-verification";
import {
  newEmailVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/verification-email";

/**
 * POST /api/auth/resend-verification
 *
 * For self-registered users who never received or lost the verification email.
 * Requires correct password. Does not apply to pending org invites (active membership).
 */
export async function POST(request: Request) {
  const blocked = applyRateLimit(
    request,
    "auth:resend-verification",
    RATE_LIMITS.RESEND_VERIFICATION,
  );
  if (blocked) return blocked;

  try {
    const body = await request.json().catch(() => null);
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        emailVerifiedAt: true,
        platformRole: true,
      },
    });

    if (!user?.email || !user.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.emailVerifiedAt || user.platformRole) {
      return NextResponse.json(
        { error: "This email is already verified. Try signing in." },
        { status: 400 },
      );
    }

    const activeMemberships = await prisma.membership.count({
      where: { userId: user.id, status: "ACTIVE" },
    });
    if (activeMemberships > 0) {
      return NextResponse.json(
        {
          error:
            "This account was created from an organization invite. Use the link in your invitation email, or ask your admin to resend the invite.",
        },
        { status: 409 },
      );
    }

    const { token: verifyToken, expiresAt: verifyExpires } = newEmailVerificationToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        isActive: false,
      },
    });

    await sendVerificationEmail(user.email, verifyToken, user.id);

    return NextResponse.json({
      message: "A new verification email has been sent. Check your inbox and spam folder.",
      sent: true,
    });
  } catch (error) {
    console.error("[resend-verification] Failed:", error);
    return NextResponse.json(
      { error: "Could not send verification email. Try again later." },
      { status: 500 },
    );
  }
}
