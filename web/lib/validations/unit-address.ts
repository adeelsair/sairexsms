import { z } from "zod";

export const createUnitAddressSchema = z.object({
  unitType: z.enum(["REGION", "SUBREGION", "CITY", "ZONE", "CAMPUS"]),
  unitId: z.string().min(1, "unitId is required"),

  country: z.string().min(1, "Country is required").max(100),
  province: z.string().min(1, "Province is required").max(100),
  city: z.string().min(1, "City is required").max(100),
  area: z.string().max(200).optional().nullable(),

  addressLine1: z.string().min(1, "Address is required").max(500),
  addressLine2: z.string().max(500).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),

  isPrimary: z.boolean().optional().default(false),
});

export type CreateUnitAddressInput = z.infer<typeof createUnitAddressSchema>;

export const updateUnitAddressSchema = createUnitAddressSchema
  .omit({ unitType: true, unitId: true })
  .partial()
  .extend({
    country: z.string().min(1, "Country is required").max(100),
    province: z.string().min(1, "Province is required").max(100),
    city: z.string().min(1, "City is required").max(100),
    addressLine1: z.string().min(1, "Address is required").max(500),
  });

export type UpdateUnitAddressInput = z.infer<typeof updateUnitAddressSchema>;
