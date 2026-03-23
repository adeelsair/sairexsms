import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { generateOrganizationId } from "@/lib/id-generators";
import { onboardingCompleteSchema } from "@/lib/validations/onboarding";
import { verifyNtnCertificate } from "@/lib/onboarding/verify-ntn-cert";
import { generateUnitCode, generateCityCode, buildFullUnitPath } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import { bootstrapDemoDataIfEmpty } from "@/lib/bootstrap/demo-seed.service";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";
import { getObjectStorage, isObjectStorageConfigured, tenantObjectKey } from "@/lib/storage";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeDataUrlBase64(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.trim().match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2].replace(/\s/g, "");
  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) return null;
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

function fileExtFromMime(mimeType: string): string {
  const mt = mimeType.toLowerCase();
  if (mt.includes("pdf")) return "pdf";
  if (mt.includes("jpeg")) return "jpg";
  if (mt.includes("jpg")) return "jpg";
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  return "bin";
}

/**
 * When object storage is configured, uploads privately and returns the **object key**
 * (`tenants/...`) for later signed GET access. Otherwise returns the inline data URL (dev).
 */
async function persistCertificateToStorage(dataUrl: string, key: string): Promise<string> {
  if (!isObjectStorageConfigured()) {
    return dataUrl;
  }

  const decoded = decodeDataUrlBase64(dataUrl);
  if (!decoded) {
    throw new Error("Certificate data URL is invalid or not base64-encoded.");
  }

  await getObjectStorage().uploadObject({
    key,
    body: decoded.buffer,
    contentType: decoded.mimeType,
    cacheControl: "private, no-store",
  });

  return key;
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

    const verify = await verifyNtnCertificate(
      legal.ntnCertificate,
      legal.taxNumber,
      identity.organizationName,
    );
    if (!verify.ok) {
      return NextResponse.json(
        {
          errors: {
            "legal.ntnCertificate": [verify.message],
          },
        },
        { status: 400 },
      );
    }

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

    // Upload certificates before the DB transaction so we can persist their URLs.
    // (registration certificate is optional; NTN certificate is required by schema)
    const registrationCertDataUrl = legal.registrationCertificate || "";
    const registrationCertName = legal.registrationCertName || null;
    const ntnCertDataUrl = legal.ntnCertificate;
    const ntnCertName = legal.ntnCertName || null;

    const regKey =
      registrationCertDataUrl && registrationCertDataUrl.length > 0
        ? tenantObjectKey(
            orgId,
            "certificates",
            `registration.${fileExtFromMime(
              decodeDataUrlBase64(registrationCertDataUrl)?.mimeType ?? "application/octet-stream",
            )}`,
          )
        : null;
    const ntnMime = decodeDataUrlBase64(ntnCertDataUrl)?.mimeType ?? "application/pdf";
    const ntnKey = tenantObjectKey(orgId, "certificates", `ntn.${fileExtFromMime(ntnMime)}`);

    let registrationCertificateUrl: string | null = null;
    if (regKey && registrationCertDataUrl) {
      registrationCertificateUrl = await persistCertificateToStorage(registrationCertDataUrl, regKey);
    }

    const ntnCertificateUrl = await persistCertificateToStorage(ntnCertDataUrl, ntnKey);

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
          facebookUrl: branding.facebookUrl || null,
          instagramUrl: branding.instagramUrl || null,
          logoUrl: branding.logoUrl || null,

          registrationCertificateUrl,
          registrationCertName,
          ntnCertificateUrl,
          ntnCertName,
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
