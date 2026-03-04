import { z } from "zod";

export const createUnitContactSchema = z.object({
  unitType: z.enum(["REGION", "SUBREGION", "CITY", "ZONE", "CAMPUS"]),
  unitId: z.string().min(1, "unitId is required"),

  name: z.string().min(1, "Contact name is required").max(200),
  designation: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email").max(200).optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),

  isPrimary: z.boolean().optional().default(false),
});

export type CreateUnitContactInput = z.infer<typeof createUnitContactSchema>;

export const updateUnitContactSchema = createUnitContactSchema
  .omit({ unitType: true, unitId: true })
  .partial()
  .extend({ name: z.string().min(1, "Contact name is required").max(200) });

export type UpdateUnitContactInput = z.infer<typeof updateUnitContactSchema>;
