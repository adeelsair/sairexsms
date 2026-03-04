import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import bcrypt from "bcryptjs";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// POST: Change password (authenticated user changes their own password)
export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:change-password", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Fetch the user from DB
    const user = await prisma.user.findUnique({
      where: { email: guard.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.password) {
      return NextResponse.json(
        { error: "Password change is unavailable for this account" },
        { status: 400 },
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    // Hash and save the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
