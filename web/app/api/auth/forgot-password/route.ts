import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueue, EMAIL_QUEUE } from "@/lib/queue";
import crypto from "crypto";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:forgot-password", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const successMessage =
      "If an account with that email exists, a reset link has been sent.";

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: successMessage });
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await enqueue({
      type: "EMAIL",
      queue: EMAIL_QUEUE,
      userId: user.id,
      payload: {
        to: email,
        subject: "Password Reset — SAIREX SMS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e40af;">SAIREX SMS</h2>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Reset Password
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">
              This link expires in 1 hour. If you didn't request this, ignore this email.
            </p>
          </div>
        `,
      },
    });

    return NextResponse.json({ message: successMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
