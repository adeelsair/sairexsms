import { z } from "zod";

// ─── Shared Constants ────────────────────────────────────────────────────────

const ADDRESS_TYPE = ["HEAD_OFFICE", "BILLING", "CAMPUS", "OTHER"] as const;

/** Pakistan provinces/territories — used for validation when country is PK */
const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "KPK",
  "Balochistan",
  "Capital Territory",
  "Gilgit-Baltistan",
  "AJK",
] as const;

// ─── Normalization Helpers ───────────────────────────────────────────────────

function normalizeString(val: string): string {
  return val.trim().replace(/\s{2,}/g, " ");
}

// ─── OrganizationAddress: CREATE Schema ──────────────────────────────────────

export const createOrganizationAddressSchema = z
  .object({
    type: z.enum(ADDRESS_TYPE, {
      message: "Address type must be one of: HEAD_OFFICE, BILLING, CAMPUS, OTHER",
    }),

    country: z
      .string()
      .min(2, "Country is required")
      .max(100, "Country must not exceed 100 characters")
      .transform(normalizeString),

    province: z
      .string()
      .min(2, "Province/State must be at least 2 characters")
      .max(100, "Province/State must not exceed 100 characters")
      .transform(normalizeString),

    city: z
      .string()
      .min(2, "City must be at least 2 characters")
      .max(100, "City must not exceed 100 characters")
      .transform(normalizeString),

    area: z
      .string()
      .min(2, "Area must be at least 2 characters")
      .max(120, "Area must not exceed 120 characters")
      .transform(normalizeString)
      .optional()
      .or(z.literal("")),

    postalCode: z
      .string()
      .min(3, "Postal code must be at least 3 characters")
      .max(12, "Postal code must not exceed 12 characters")
      .regex(/^[a-zA-Z0-9\s-]+$/, "Postal code must be alphanumeric")
      .optional()
      .or(z.literal("")),

    addressLine1: z
      .string()
      .min(5, "Address line 1 must be at least 5 characters")
      .max(150, "Address line 1 must not exceed 150 characters")
      .transform(normalizeString),

    addressLine2: z
      .string()
      .min(2, "Address line 2 must be at least 2 characters")
      .max(150, "Address line 2 must not exceed 150 characters")
      .transform(normalizeString)
      .optional()
      .or(z.literal("")),

    isPrimary: z.boolean({
      message: "isPrimary is required and must be true or false",
    }),
  })
  .refine(
    (data) => {
      if (data.country !== "Pakistan") return true;
      return PAKISTAN_PROVINCES.includes(data.province as typeof PAKISTAN_PROVINCES[number]);
    },
    {
      message: `For Pakistan, province must be one of: ${PAKISTAN_PROVINCES.join(", ")}`,
      path: ["province"],
    }
  )
  .transform((data) => ({
    ...data,
    area: data.area || undefined,
    postalCode: data.postalCode || undefined,
    addressLine2: data.addressLine2 || undefined,
  }));

// ─── OrganizationAddress: UPDATE Schema ──────────────────────────────────────

export const updateOrganizationAddressSchema = z
  .object({
    type: z.enum(ADDRESS_TYPE, {
      message: "Address type must be one of: HEAD_OFFICE, BILLING, CAMPUS, OTHER",
    }).optional(),

    country: z
      .string()
      .min(2, "Country is required")
      .max(100, "Country must not exceed 100 characters")
      .transform(normalizeString)
      .optional(),

    province: z
      .string()
      .min(2, "Province/State must be at least 2 characters")
      .max(100, "Province/State must not exceed 100 characters")
      .transform(normalizeString)
      .optional(),

    city: z
      .string()
      .min(2, "City must be at least 2 characters")
      .max(100, "City must not exceed 100 characters")
      .transform(normalizeString)
      .optional(),

    area: z
      .string()
      .min(2, "Area must be at least 2 characters")
      .max(120, "Area must not exceed 120 characters")
      .transform(normalizeString)
      .optional()
      .or(z.literal("")),

    postalCode: z
      .string()
      .min(3, "Postal code must be at least 3 characters")
      .max(12, "Postal code must not exceed 12 characters")
      .regex(/^[a-zA-Z0-9\s-]+$/, "Postal code must be alphanumeric")
      .optional()
      .or(z.literal("")),

    addressLine1: z
      .string()
      .min(5, "Address line 1 must be at least 5 characters")
      .max(150, "Address line 1 must not exceed 150 characters")
      .transform(normalizeString)
      .optional(),

    addressLine2: z
      .string()
      .min(2, "Address line 2 must be at least 2 characters")
      .max(150, "Address line 2 must not exceed 150 characters")
      .transform(normalizeString)
      .optional()
      .or(z.literal("")),

    isPrimary: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.country || data.country !== "Pakistan") return true;
      if (!data.province) return true;
      return PAKISTAN_PROVINCES.includes(data.province as typeof PAKISTAN_PROVINCES[number]);
    },
    {
      message: `For Pakistan, province must be one of: ${PAKISTAN_PROVINCES.join(", ")}`,
      path: ["province"],
    }
  )
  .transform((data) => ({
    ...data,
    area: data.area || undefined,
    postalCode: data.postalCode || undefined,
    addressLine2: data.addressLine2 || undefined,
  }));

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateOrganizationAddressInput = z.input<typeof createOrganizationAddressSchema>;
export type CreateOrganizationAddressData = z.output<typeof createOrganizationAddressSchema>;
export type UpdateOrganizationAddressInput = z.input<typeof updateOrganizationAddressSchema>;
export type UpdateOrganizationAddressData = z.output<typeof updateOrganizationAddressSchema>;

// Re-export constants for use in UI dropdowns
export { ADDRESS_TYPE, PAKISTAN_PROVINCES };
