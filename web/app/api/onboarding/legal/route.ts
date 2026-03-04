import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { onboardingLegalSchema } from "@/lib/validations/onboarding";

/**
 * POST /api/onboarding/legal
 *
 * Step 2: Updates the Organization with legal information.
 * Advances onboardingStep from ORG_IDENTITY → LEGAL.
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

    if (org.onboardingStep !== "ORG_IDENTITY") {
      return NextResponse.json(
        { error: "Legal information has already been submitted." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = onboardingLegalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        registrationNumber: parsed.data.registrationNumber,
        taxNumber: parsed.data.taxNumber,
        establishedDate: new Date(parsed.data.establishedDate),
        onboardingStep: "LEGAL",
      },
    });

    return NextResponse.json({
      message: "Legal information saved",
      nextUrl: "/onboarding/contact-address",
    });
  } catch (error) {
    console.error("Onboarding legal error:", error);
    return NextResponse.json(
      { error: "Failed to save legal information" },
      { status: 500 },
    );
  }
}
