import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import {
  onboardingBrandingSchema,
  onboardingContactAddressSchema,
  onboardingIdentitySchema,
  onboardingLegalSchema,
} from "@/lib/validations/onboarding";

const profileSchema = z.object({
  identity: onboardingIdentitySchema,
  // Certificates are currently onboarding-only (not persisted on Organization).
  legal: onboardingLegalSchema.omit({
    registrationCertificate: true,
    registrationCertName: true,
    ntnCertificate: true,
    ntnCertName: true,
  }),
  contactAddress: onboardingContactAddressSchema,
  branding: onboardingBrandingSchema,
});

export type OrganizationProfileInput = z.input<typeof profileSchema>;

function toDateInput(value: Date | null): string {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * GET /api/admin/profile
 *
 * Returns current organization profile fields shaped like onboarding sections,
 * for reuse in Settings → Profile.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;
  if (!guard.organizationId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: guard.organizationId },
    select: {
      id: true,
      slug: true,
      onboardingStep: true,
      organizationName: true,
      displayName: true,
      organizationCategory: true,
      organizationStructure: true,
      registrationNumber: true,
      taxNumber: true,
      establishedDate: true,
      addressLine1: true,
      addressLine2: true,
      country: true,
      provinceState: true,
      district: true,
      tehsil: true,
      city: true,
      postalCode: true,
      organizationEmail: true,
      organizationPhone: true,
      organizationMobile: true,
      organizationWhatsApp: true,
      websiteUrl: true,
      facebookUrl: true,
      instagramUrl: true,

      registrationCertificateUrl: true,
      registrationCertName: true,
      ntnCertificateUrl: true,
      ntnCertName: true,

      logoUrl: true,
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const data: OrganizationProfileInput = {
    identity: {
      organizationName: org.organizationName ?? "",
      displayName: org.displayName ?? "",
      organizationCategory: org.organizationCategory,
      organizationStructure: org.organizationStructure,
    },
    legal: {
      registrationNumber: org.registrationNumber ?? "",
      taxNumber: org.taxNumber ?? "",
      establishedDate: toDateInput(org.establishedDate ?? null),
    },
    contactAddress: {
      addressLine1: org.addressLine1 ?? "",
      addressLine2: org.addressLine2 ?? "",
      country: org.country ?? "",
      provinceState: org.provinceState ?? "",
      district: org.district ?? "",
      tehsil: org.tehsil ?? "",
      city: org.city ?? "",
      postalCode: org.postalCode ?? "",
      organizationEmail: org.organizationEmail ?? "",
      organizationPhone: org.organizationPhone ?? "",
      organizationMobile: org.organizationMobile ?? "",
      organizationWhatsApp: org.organizationWhatsApp ?? "",
    },
    branding: {
      websiteUrl: org.websiteUrl ?? "",
      facebookUrl: org.facebookUrl ?? "",
      instagramUrl: org.instagramUrl ?? "",
      logoUrl: org.logoUrl ?? "",
      logoVariants: [],
    },
  };

  return NextResponse.json({
    ok: true,
    organization: { id: org.id, slug: org.slug, onboardingStep: org.onboardingStep },
    profile: data,
    legalCertificates: {
      registration: {
        url: org.registrationCertificateUrl,
        name: org.registrationCertName,
      },
      ntn: {
        url: org.ntnCertificateUrl,
        name: org.ntnCertName,
      },
    },
  });
}

/**
 * PATCH /api/admin/profile
 *
 * Updates persisted Organization fields from the onboarding-shaped payload.
 * Does NOT advance onboardingStep.
 */
export async function PATCH(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;
  if (!guard.organizationId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!key) continue;
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return NextResponse.json(
      { ok: false, fieldErrors, error: "Invalid profile data" },
      { status: 400 },
    );
  }

  const { identity, legal, contactAddress, branding } = parsed.data;

  await prisma.organization.update({
    where: { id: guard.organizationId },
    data: {
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
    },
  });

  return NextResponse.json({ ok: true });
}

