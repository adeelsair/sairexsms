import { z } from "zod";

export const providerCheckSchema = z
  .object({
    schoolId: z.string().min(1, "School ID is required"),
    provider: z.enum(["BANK", "1BILL", "EASYPAISA", "JAZZCASH", "CARD"]),
    mode: z.enum(["AUTO", "MANUAL"]),
    bankName: z.string().max(100).optional().or(z.literal("")),
    accountTitle: z.string().max(100).optional().or(z.literal("")),
    accountNumber: z.string().max(50).optional().or(z.literal("")),
    providerMerchantId: z.string().max(80).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.mode !== "MANUAL") return;

    if (!value.bankName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankName"],
        message: "Bank name is required for manual check",
      });
    }
    if (!value.accountTitle?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountTitle"],
        message: "Account title is required for manual check",
      });
    }
    if (!value.accountNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountNumber"],
        message: "Account number is required for manual check",
      });
    }
    if (value.provider !== "BANK" && !value.providerMerchantId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerMerchantId"],
        message: "Merchant ID is required for manual provider check",
      });
    }
  });

export type ProviderCheckInput = z.infer<typeof providerCheckSchema>;
