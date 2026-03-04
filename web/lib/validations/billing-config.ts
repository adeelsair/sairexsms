import { z } from "zod";

export const billingConfigSchema = z.object({
  perStudentFee: z
    .string()
    .min(1, "Per student fee is required")
    .refine((value) => Number(value) >= 0, "Per student fee must be zero or greater"),
  revenueCalculationMode: z.enum(["ON_GENERATED_FEE", "ON_COLLECTED_FEE"]),
  closingDay: z
    .string()
    .min(1, "Closing day is required")
    .refine((value) => {
      const num = Number(value);
      return Number.isInteger(num) && num >= 1 && num <= 28;
    }, "Closing day must be between 1 and 28"),
});

export type BillingConfigInput = z.infer<typeof billingConfigSchema>;

export const billingConfigUpdateSchema = z.object({
  perStudentFee: z.coerce.number().min(0, "Per student fee must be zero or greater"),
  revenueCalculationMode: z.enum(["ON_GENERATED_FEE", "ON_COLLECTED_FEE"]),
  closingDay: z.coerce
    .number()
    .int("Closing day must be a whole number")
    .min(1, "Closing day must be between 1 and 28")
    .max(28, "Closing day must be between 1 and 28"),
});

export type BillingConfigUpdateInput = z.infer<typeof billingConfigUpdateSchema>;

