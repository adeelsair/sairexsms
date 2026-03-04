import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// POST: Reset password using a token (unauthenticated)
export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:reset-password", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(token);

    // Lookup by hash (new storage) with plaintext fallback for in-flight old links.
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token }],
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Check if already used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "This reset link has already been used" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash the new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
