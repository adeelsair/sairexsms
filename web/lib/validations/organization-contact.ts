import { z } from "zod";

// ─── Shared Constants ────────────────────────────────────────────────────────

/** E.164 phone format: +{country code}{number}, 8-15 digits total after + */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

// ─── Normalization Helpers ───────────────────────────────────────────────────

function normalizeString(val: string): string {
  return val.trim().replace(/\s{2,}/g, " ");
}

function normalizeEmail(val: string): string {
  return val.trim().toLowerCase();
}

// ─── Base field schemas (reused in create & update) ──────────────────────────

const nameField = z
  .string()
  .min(3, "Contact name must be at least 3 characters")
  .max(120, "Contact name must not exceed 120 characters")
  .regex(/^[a-zA-Z\s.]+$/, "Contact name may only contain letters, spaces, and periods")
  .transform(normalizeString);

const designationField = z
  .string()
  .min(2, "Designation must be at least 2 characters")
  .max(100, "Designation must not exceed 100 characters")
  .transform(normalizeString);

const phoneField = z
  .string()
  .regex(E164_REGEX, "Phone must be in E.164 format (e.g., +923001234567)");

const emailField = z
  .string()
  .trim()
  .email("Must be a valid email address")
  .max(255, "Email must not exceed 255 characters")
  .transform(normalizeEmail);

// ─── OrganizationContact: CREATE Schema ──────────────────────────────────────

export const createOrganizationContactSchema = z
  .object({
    name: nameField,

    designation: designationField.optional().or(z.literal("")),

    phone: phoneField.optional().or(z.literal("")),

    email: emailField.optional().or(z.literal("")),

    isPrimary: z.boolean({
      message: "isPrimary is required and must be true or false",
    }),
  })
  .transform((data) => ({
    ...data,
    designation: data.designation || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined,
  }));

// ─── OrganizationContact: UPDATE Schema ──────────────────────────────────────

export const updateOrganizationContactSchema = z
  .object({
    name: nameField.optional(),

    designation: designationField.optional().or(z.literal("")),

    phone: phoneField.optional().or(z.literal("")),

    email: emailField.optional().or(z.literal("")),

    isPrimary: z.boolean().optional(),
  })
  .transform((data) => ({
    ...data,
    designation: data.designation || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined,
  }));

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateOrganizationContactInput = z.input<typeof createOrganizationContactSchema>;
export type CreateOrganizationContactData = z.output<typeof createOrganizationContactSchema>;
export type UpdateOrganizationContactInput = z.input<typeof updateOrganizationContactSchema>;
export type UpdateOrganizationContactData = z.output<typeof updateOrganizationContactSchema>;
