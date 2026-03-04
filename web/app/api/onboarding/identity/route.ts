import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { generateOrganizationId } from "@/lib/id-generators";
import { onboardingIdentitySchema } from "@/lib/validations/onboarding";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * POST /api/onboarding/identity
 *
 * Step 1: Creates the Organization with core identity fields
 * and an ORG_ADMIN membership for the founder.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const existingMembership = await prisma.membership.findFirst({
      where: { userId: guard.id, status: "ACTIVE" },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "You already have an organization. Proceed to the next step." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = onboardingIdentitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const slug = slugify(parsed.data.displayName);
    const finalSlug = slug.length >= 3 ? slug : `org-${Date.now().toString(36)}`;

    const existingSlug = await prisma.organization.findUnique({
      where: { slug: finalSlug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { errors: { organizationName: ["An organization with a similar name already exists"] } },
        { status: 409 },
      );
    }

    const orgId = await generateOrganizationId();

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          id: orgId,
          slug: finalSlug,
          organizationName: parsed.data.organizationName,
          displayName: parsed.data.displayName,
          organizationCategory: parsed.data.organizationCategory,
          organizationStructure: parsed.data.organizationStructure,
          status: "ACTIVE",
          onboardingStep: "ORG_IDENTITY",
          createdByUserId: guard.id,
        },
      });

      await tx.membership.create({
        data: {
          userId: guard.id,
          organizationId: org.id,
          role: "ORG_ADMIN",
          status: "ACTIVE",
        },
      });

      return org;
    });

    return NextResponse.json(
      {
        message: "Organization created",
        organizationId: result.id,
        organizationName: result.organizationName,
        nextUrl: "/onboarding/legal",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Onboarding identity error:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}
