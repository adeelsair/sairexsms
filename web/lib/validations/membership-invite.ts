import { z } from "zod";

const SCOPED_ROLES = [
  "REGION_ADMIN",
  "SUBREGION_ADMIN",
  "ZONE_ADMIN",
  "CAMPUS_ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "PARENT",
] as const;

const ORG_WIDE_ROLES = ["ORG_ADMIN"] as const;

export const ALL_ASSIGNABLE_ROLES = [...ORG_WIDE_ROLES, ...SCOPED_ROLES] as const;

export const SINGLE_STRUCTURE_ROLES = [
  "ORG_ADMIN",
  "CAMPUS_ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "PARENT",
] as const;

export function roleRequiresUnit(role: string): boolean {
  return (SCOPED_ROLES as readonly string[]).includes(role);
}

export const inviteMembershipSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    name: z.string().min(1, "Name is required").max(200).optional(),

    role: z.enum([
      "ORG_ADMIN",
      "REGION_ADMIN",
      "SUBREGION_ADMIN",
      "ZONE_ADMIN",
      "CAMPUS_ADMIN",
      "TEACHER",
      "ACCOUNTANT",
      "STAFF",
      "PARENT",
    ]),

    unitId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (roleRequiresUnit(data.role) && !data.unitId) return false;
      return true;
    },
    { message: "A unit must be selected for this role", path: ["unitId"] },
  );

export type InviteMembershipInput = z.infer<typeof inviteMembershipSchema>;
