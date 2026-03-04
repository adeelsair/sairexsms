import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { onboardingBrandingSchema } from "@/lib/validations/onboarding";

/**
 * POST /api/onboarding/branding
 *
 * Step 4 (final): Updates the Organization with branding (logo),
 * then marks onboarding as COMPLETED.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const membership = await prisma.membership.findFirst({
      where: { userId: guard.id, status: "ACTIVE" },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You need to create an organization first." },
        { status: 400 },
      );
    }

    const org = membership.organization;

    if (org.onboardingStep !== "CONTACT_ADDRESS") {
      return NextResponse.json(
        { error: "Please complete the previous step first." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = onboardingBrandingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        logoUrl: parsed.data.logoUrl || null,
        onboardingStep: "COMPLETED",
      },
    });

    return NextResponse.json({
      message: "Onboarding completed! Your organization is now active.",
      nextUrl: "/admin/dashboard",
    });
  } catch (error) {
    console.error("Onboarding branding error:", error);
    return NextResponse.json(
      { error: "Failed to save branding" },
      { status: 500 },
    );
  }
}
