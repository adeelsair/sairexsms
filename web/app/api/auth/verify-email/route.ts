import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Validates the email verification token, activates the user,
 * and redirects to the login page.
 */
export async function GET(request: Request) {
  const blocked = applyRateLimit(request, "auth:verify-email", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return redirectWithError("Token is required");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      return redirectWithError("Invalid verification link");
    }

    if (user.emailVerifiedAt) {
      return redirectWithSuccess("Email already verified");
    }

    if (user.emailVerifyExpires && new Date() > user.emailVerifyExpires) {
      return redirectWithError("Verification link has expired. Please register again.");
    }

    // Activate user + clear verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        isActive: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    return redirectWithSuccess("Email verified successfully");
  } catch (error) {
    console.error("Email verification error:", error);
    return redirectWithError("Verification failed. Please try again.");
  }
}

function redirectWithSuccess(message: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL("/login", baseUrl);
  url.searchParams.set("verified", "true");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function redirectWithError(message: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL("/verify-email", baseUrl);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
