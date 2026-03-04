import { z } from "zod";

// ─── Shared Constants ────────────────────────────────────────────────────────

const ORGANIZATION_CATEGORY = [
  "SCHOOL", "COLLEGE", "ACADEMY", "INSTITUTE", "UNIVERSITY", "OTHERS",
] as const;

const ORGANIZATION_STRUCTURE = [
  "SINGLE", "MULTIPLE",
] as const;

const ORGANIZATION_STATUS = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;

// ─── Normalization Helpers ───────────────────────────────────────────────────

function normalizeString(val: string): string {
  return val.trim().replace(/\s{2,}/g, " ");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Organization: CREATE Schema ─────────────────────────────────────────────

export const createOrganizationSchema = z
  .object({
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

    slug: z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(60, "Slug must not exceed 60 characters")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slug must start and end with a letter or number, hyphens only between segments (e.g., my-school-1)"
      )
      .optional()
      .or(z.literal(""))
      .default(""),

    organizationCategory: z.enum(ORGANIZATION_CATEGORY, {
      message: "Please select a valid organization category",
    }),

    organizationStructure: z.enum(ORGANIZATION_STRUCTURE, {
      message: "Please select a valid organization structure",
    }),

    status: z.enum(ORGANIZATION_STATUS, {
      message: "Status must be one of: ACTIVE, SUSPENDED, ARCHIVED",
    }).default("ACTIVE"),
  })
  .transform((data) => {
    const autoSlug = data.slug || slugify(data.organizationName);
    return {
      ...data,
      slug: autoSlug.length >= 3 ? autoSlug : `org-${Date.now().toString(36)}`,
    };
  });

// ─── Organization: UPDATE Schema (all fields optional) ───────────────────────

export const updateOrganizationSchema = z
  .object({
    organizationName: z
      .string()
      .min(3, "Organization name must be at least 3 characters")
      .max(150, "Organization name must not exceed 150 characters")
      .regex(
        /^[a-zA-Z0-9\s.&()\-]+$/,
        "Organization name may only contain letters, numbers, spaces, periods, ampersands, parentheses, and hyphens"
      )
      .transform(normalizeString)
      .optional(),

    displayName: z
      .string()
      .min(2, "Display name must be at least 2 characters")
      .max(100, "Display name must not exceed 100 characters")
      .transform(normalizeString)
      .optional(),

    slug: z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(60, "Slug must not exceed 60 characters")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slug must start and end with a letter or number, hyphens only between segments (e.g., my-school-1)"
      )
      .optional(),

    organizationCategory: z.enum(ORGANIZATION_CATEGORY, {
      message: "Please select a valid organization category",
    }).optional(),

    organizationStructure: z.enum(ORGANIZATION_STRUCTURE, {
      message: "Please select a valid organization structure",
    }).optional(),

    status: z.enum(ORGANIZATION_STATUS, {
      message: "Status must be one of: ACTIVE, SUSPENDED, ARCHIVED",
    }).optional(),
  });

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type CreateOrganizationData = z.output<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;
export type UpdateOrganizationData = z.output<typeof updateOrganizationSchema>;

// Re-export constants for use in UI dropdowns
export { ORGANIZATION_CATEGORY, ORGANIZATION_STRUCTURE, ORGANIZATION_STATUS };
