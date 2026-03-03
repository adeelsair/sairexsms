import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { onboardingContactAddressSchema } from "@/lib/validations/onboarding";

/**
 * POST /api/onboarding/contact-address
 *
 * Step 3: Updates the Organization with HQ address and contact information.
 * Advances onboardingStep from LEGAL → CONTACT_ADDRESS.
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

    if (org.onboardingStep !== "LEGAL") {
      return NextResponse.json(
        { error: "Please complete the previous step first." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = onboardingContactAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        country: parsed.data.country,
        provinceState: parsed.data.provinceState,
        district: parsed.data.district,
        tehsil: parsed.data.tehsil,
        city: parsed.data.city,
        postalCode: parsed.data.postalCode || null,
        organizationEmail: parsed.data.organizationEmail,
        organizationPhone: parsed.data.organizationPhone,
        organizationMobile: parsed.data.organizationMobile,
        organizationWhatsApp: parsed.data.organizationWhatsApp || null,
        onboardingStep: "CONTACT_ADDRESS",
      },
    });

    return NextResponse.json({
      message: "Contact & address information saved",
      nextUrl: "/onboarding/branding",
    });
  } catch (error) {
    console.error("Onboarding contact-address error:", error);
    return NextResponse.json(
      { error: "Failed to save contact & address information" },
      { status: 500 },
    );
  }
}
