import { z } from "zod";

export const updateMembershipSchema = z.object({
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
});

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
