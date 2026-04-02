import { z } from "zod";

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
