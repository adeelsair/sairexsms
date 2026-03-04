import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";

/**
 * GET /api/onboarding/status
 *
 * Returns the user's onboarding state:
 *  - NO_ACCOUNT  → /signup
 *  - UNVERIFIED  → /verify-email
 *  - NO_ORG      → /onboarding/identity  (wizard manages steps client-side)
 *  - COMPLETED   → /admin/dashboard
 */
export async function GET() {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const user = await prisma.user.findUnique({
      where: { id: guard.id },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { step: "NO_ACCOUNT", nextUrl: "/signup" },
      );
    }

    if (!user.emailVerifiedAt && !user.platformRole) {
      return NextResponse.json(
        { step: "UNVERIFIED", nextUrl: "/verify-email" },
      );
    }

    const membership = user.memberships[0];

    if (!membership) {
      return NextResponse.json(
        { step: "NO_ORG", nextUrl: "/onboarding/identity", userEmail: user.email },
      );
    }

    return NextResponse.json({
      step: "COMPLETED",
      nextUrl: "/admin/dashboard",
      organizationId: membership.organization.id,
    });
  } catch (error) {
    console.error("Onboarding status error:", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 },
    );
  }
}
