import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { generateOrganizationId } from "@/lib/id-generators";
import { onboardingCompleteSchema } from "@/lib/validations/onboarding";
import { generateUnitCode, generateCityCode, buildFullUnitPath } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import { bootstrapDemoDataIfEmpty } from "@/lib/bootstrap/demo-seed.service";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * POST /api/onboarding/complete
 *
 * Unified endpoint: validates ALL onboarding data, generates the
 * Organization ID, and creates the Organization + Membership in a
 * single transaction. For SINGLE-structure orgs, also auto-creates
 * a default City (from HQ address) and the main Campus.
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
        { error: "You already have an organization." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = onboardingCompleteSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const { identity, legal, contactAddress, branding } = parsed.data;

    const slug = slugify(identity.displayName);
    const finalSlug = slug.length >= 3 ? slug : `org-${Date.now().toString(36)}`;

    const existingSlug = await prisma.organization.findUnique({
      where: { slug: finalSlug },
    });

    if (existingSlug) {
      return NextResponse.json(
        {
          errors: {
            "identity.organizationName": [
              "An organization with a similar name already exists",
            ],
          },
        },
        { status: 409 },
      );
    }

    const orgId = await generateOrganizationId();

    const trialWindow = createTrialWindow();
    const result = await prisma.$transaction(async (tx) => {
      /* ── 1. Create Organization ─────────────────────────── */
      const created = await tx.organization.create({
        data: {
          id: orgId,
          slug: finalSlug,
          status: "ACTIVE",
          onboardingStep: "COMPLETED",
          createdByUserId: guard.id,

          organizationName: identity.organizationName,
          displayName: identity.displayName,
          organizationCategory: identity.organizationCategory,
          organizationStructure: identity.organizationStructure,

          registrationNumber: legal.registrationNumber,
          taxNumber: legal.taxNumber,
          establishedDate: new Date(legal.establishedDate),

          addressLine1: contactAddress.addressLine1,
          addressLine2: contactAddress.addressLine2 || null,
          country: contactAddress.country,
          provinceState: contactAddress.provinceState,
          district: contactAddress.district,
          tehsil: contactAddress.tehsil,
          city: contactAddress.city,
          postalCode: contactAddress.postalCode || null,
          organizationEmail: contactAddress.organizationEmail,
          organizationPhone: contactAddress.organizationPhone,
          organizationMobile: contactAddress.organizationMobile,
          organizationWhatsApp: contactAddress.organizationWhatsApp || null,

          websiteUrl: branding.websiteUrl || null,
          logoUrl: branding.logoUrl || null,
        },
      });

      await tx.organizationPlan.upsert({
        where: { organizationId: created.id },
        create: {
          organizationId: created.id,
          planType: "FREE",
          active: true,
          trialPlanType: TRIAL_POLICY.trialPlanType,
          trialStartedAt: trialWindow.trialStartedAt,
          trialEndsAt: trialWindow.trialEndsAt,
        },
        update: {},
      });

      /* ── 2. Auto-create main campus for SINGLE structure ── */
      let mainCampusId: number | null = null;

      if (created.organizationStructure === "SINGLE") {
        const cityName = contactAddress.city || created.displayName;
        const cityCode = await generateCityCode(cityName, orgId, tx);

        const defaultCity = await tx.city.create({
          data: {
            name: cityName,
            unitCode: cityCode,
            organizationId: orgId,
          },
        });

        const campusUnitCode = await generateUnitCode("CAMPUS", defaultCity.id, orgId, tx);
        const fullUnitPath = await buildFullUnitPath(defaultCity.id, null, campusUnitCode, tx);

        const campusCode = `${orgId}-${fullUnitPath}`;

        const campus = await tx.campus.create({
          data: {
            name: created.displayName,
            campusCode,
            campusSlug: campusCode.toLowerCase(),
            unitCode: campusUnitCode,
            fullUnitPath,
            organizationId: orgId,
            cityId: defaultCity.id,
            isMainCampus: true,
            status: "ACTIVE",
          },
        });

        mainCampusId = campus.id;

        await createUnitProfile({ tx, organizationId: orgId, unitType: "CITY", unitId: defaultCity.id, displayName: cityName });
        await createUnitProfile({ tx, organizationId: orgId, unitType: "CAMPUS", unitId: String(campus.id), displayName: campus.name });
      }

      /* ── 3. Create ORG_ADMIN membership ─────────────────── */
      const membership = await tx.membership.create({
        data: {
          userId: guard.id,
          organizationId: created.id,
          role: "ORG_ADMIN",
          status: "ACTIVE",
          campusId: mainCampusId,
        },
      });

      return { org: created, membership, mainCampusId };
    });

    const demoSeed = await bootstrapDemoDataIfEmpty(result.org.id);

    return NextResponse.json(
      {
        ...result.org,
        demoSeed,
        membership: {
          id: result.membership.id,
          role: result.membership.role,
          organizationId: result.membership.organizationId,
          organizationStructure: result.org.organizationStructure,
          campusId: result.mainCampusId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Onboarding complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 },
    );
  }
}
