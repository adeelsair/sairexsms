import { z } from "zod";

export const createUnitBankSchema = z.object({
  unitType: z.enum(["REGION", "SUBREGION", "CITY", "ZONE", "CAMPUS"]),
  unitId: z.string().min(1, "unitId is required"),

  bankName: z.string().min(1, "Bank name is required").max(200),
  branchName: z.string().max(200).optional().nullable(),
  branchCode: z.string().max(20).optional().nullable(),

  accountTitle: z.string().min(1, "Account title is required").max(200),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  iban: z
    .string()
    .max(34, "IBAN must be at most 34 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  swiftCode: z
    .string()
    .max(11, "SWIFT code must be at most 11 characters")
    .optional()
    .nullable()
    .or(z.literal("")),

  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateUnitBankInput = z.infer<typeof createUnitBankSchema>;

export const updateUnitBankSchema = createUnitBankSchema
  .omit({ unitType: true, unitId: true })
  .partial()
  .extend({
    accountTitle: z.string().min(1, "Account title is required").max(200),
    accountNumber: z.string().min(1, "Account number is required").max(50),
    bankName: z.string().min(1, "Bank name is required").max(200),
  });

export type UpdateUnitBankInput = z.infer<typeof updateUnitBankSchema>;
