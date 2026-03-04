import { z } from "zod";

export const updateUnitProfileSchema = z.object({
  unitType: z.enum(["REGION", "SUBREGION", "CITY", "ZONE", "CAMPUS"]),
  unitId: z.string().min(1, "unitId is required"),
  displayName: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email").max(200).optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  websiteUrl: z.string().url("Invalid URL").max(500).optional().nullable().or(z.literal("")),
  logoUrl: z.string().url("Invalid URL").max(500).optional().nullable().or(z.literal("")),
});

export type UpdateUnitProfileInput = z.infer<typeof updateUnitProfileSchema>;
