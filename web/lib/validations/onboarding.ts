import { z } from "zod";

// ─── Constants ───────────────────────────────────────────────────────────────

const ORGANIZATION_CATEGORY = [
  "SCHOOL", "COLLEGE", "ACADEMY", "INSTITUTE", "UNIVERSITY", "OTHERS",
] as const;

const ORGANIZATION_STRUCTURE = [
  "SINGLE", "MULTIPLE",
] as const;

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeString(val: string): string {
  return val.trim().replace(/\s{2,}/g, " ");
}

// ─── Step 1: Organization Identity ──────────────────────────────────────────

export const onboardingIdentitySchema = z.object({
  organizationName: z
    .string()
    .min(3, "Organization name must be at least 3 characters")
    .max(150, "Organization name must not exceed 150 characters")
    .regex(
      /^[a-zA-Z0-9\s.&()\-]+$/,
      "Organization name may only contain letters, numbers, spaces, periods, ampersands, parentheses, and hyphens"
    )
    .transform(normalizeString),

  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must not exceed 100 characters")
    .transform(normalizeString),

  organizationCategory: z.enum(ORGANIZATION_CATEGORY, {
    message: "Please select a valid organization category",
  }),

  organizationStructure: z.enum(ORGANIZATION_STRUCTURE, {
    message: "Please select a valid organization structure",
  }),
});

export type OnboardingIdentityInput = z.input<typeof onboardingIdentitySchema>;
export type OnboardingIdentityData = z.output<typeof onboardingIdentitySchema>;

// ─── Step 2: Legal Information ──────────────────────────────────────────────

export const onboardingLegalSchema = z.object({
  registrationNumber: z
    .string()
    .min(1, "Registration number is required (enter N/A if not registered)")
    .max(50, "Registration number must not exceed 50 characters")
    .transform(normalizeString),

  taxNumber: z
    .string()
    .min(1, "NTN / Tax number is required (FBR Pakistan)")
    .transform((v) => v.trim().replace(/\s+/g, ""))
    .refine(
      (v) => /^\d{7}$|^\d{8}$|^\d{7}-\d$/.test(v),
      "NTN must follow FBR format: 7 digits (business), 8 digits (individual), or 7 digits hyphen 1 check digit (e.g. 1234567 or 1234567-8)"
    ),

  establishedDate: z
    .string()
    .min(1, "Established date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Must be a valid date"),

  registrationCertificate: z.string().optional().or(z.literal("")),
  registrationCertName: z.string().optional().or(z.literal("")),
  ntnCertificate: z
    .string()
    .min(1, "NTN certificate upload is required"),
  ntnCertName: z
    .string()
    .min(1, "NTN certificate file is required"),
});

export type OnboardingLegalInput = z.input<typeof onboardingLegalSchema>;
export type OnboardingLegalData = z.output<typeof onboardingLegalSchema>;

// ─── Step 3: Contact & Address ──────────────────────────────────────────────

export const onboardingContactAddressSchema = z.object({
  // HQ Address
  addressLine1: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address must not exceed 200 characters")
    .transform(normalizeString),

  addressLine2: z
    .string()
    .max(200)
    .transform(normalizeString)
    .optional()
    .or(z.literal("")),

  country: z
    .string()
    .min(2, "Country is required")
    .max(100)
    .transform(normalizeString),

  provinceState: z
    .string()
    .min(2, "Province/State is required")
    .max(100)
    .transform(normalizeString),

  district: z
    .string()
    .min(2, "District is required")
    .max(100)
    .transform(normalizeString),

  tehsil: z
    .string()
    .min(2, "Tehsil is required")
    .max(100)
    .transform(normalizeString),

  city: z
    .string()
    .min(2, "City is required")
    .max(100)
    .transform(normalizeString),

  postalCode: z
    .string()
    .max(12)
    .optional()
    .or(z.literal("")),

  // Contact
  organizationEmail: z
    .string()
    .min(1, "Organization email is required")
    .email("Must be a valid email address")
    .transform((v) => v.toLowerCase().trim()),

  organizationPhone: z
    .string()
    .min(7, "Land line number must be at least 7 characters")
    .max(20, "Land line number must not exceed 20 characters"),

  organizationMobile: z
    .string()
    .min(7, "Mobile number must be at least 7 characters")
    .max(20, "Mobile number must not exceed 20 characters"),

  organizationWhatsApp: z
    .string()
    .max(20)
    .optional()
    .or(z.literal("")),
});

export type OnboardingContactAddressInput = z.input<typeof onboardingContactAddressSchema>;
export type OnboardingContactAddressData = z.output<typeof onboardingContactAddressSchema>;

// ─── Step 4: Branding ───────────────────────────────────────────────────────

export const onboardingBrandingLogoVariantSchema = z.object({
  variant: z.string(),
  url: z.string(),
});

export const onboardingBrandingSchema = z.object({
  logoUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),

  websiteUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),

  facebookUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),

  instagramUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),

  logoVariants: z.array(onboardingBrandingLogoVariantSchema).optional().default([]),
});

export type OnboardingBrandingInput = z.input<typeof onboardingBrandingSchema>;
export type OnboardingBrandingData = z.output<typeof onboardingBrandingSchema>;

// ─── Combined: Full Onboarding Payload ─────────────────────────────────────

export const onboardingCompleteSchema = z.object({
  identity: onboardingIdentitySchema,
  legal: onboardingLegalSchema,
  contactAddress: onboardingContactAddressSchema,
  branding: onboardingBrandingSchema,
});

export type OnboardingCompleteInput = z.input<typeof onboardingCompleteSchema>;
export type OnboardingCompleteData = z.output<typeof onboardingCompleteSchema>;

// Re-export constants
export { ORGANIZATION_CATEGORY as ONBOARDING_ORGANIZATION_CATEGORY };
export { ORGANIZATION_STRUCTURE as ONBOARDING_ORGANIZATION_STRUCTURE };
