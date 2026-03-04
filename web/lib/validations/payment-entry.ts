import { z } from "zod";

export const paymentEntrySchema = z.object({
  challanId: z.string().min(1, "Select a challan"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.enum(["OTC", "BANK_TRANSFER", "OTHER"]),
  referenceNumber: z.string().max(80, "Reference number is too long").optional().or(z.literal("")),
  notes: z.string().max(250, "Notes are too long").optional().or(z.literal("")),
});

export type PaymentEntryInput = z.infer<typeof paymentEntrySchema>;

