import { z } from "zod";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
  isPasswordPolicyCompliant,
} from "@/lib/auth/password-policy";

// ─── Register Schema ─────────────────────────────────────────────────────────
//
// Used by the /api/auth/signup route.
//
// Two flows:
//   1. Invite flow:   inviteToken present → name/email/password only
//   2. Register flow:  no inviteToken → name/email/password (org created later in onboarding)
//

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(150, "Name must not exceed 150 characters"),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .transform((v) => v.toLowerCase().trim()),

    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`)
      .refine((value) => isPasswordPolicyCompliant(value), {
        message: PASSWORD_POLICY_ERROR,
      }),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),

    inviteToken: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Type Exports ────────────────────────────────────────────────────────────

export type SignupInput = z.input<typeof signupSchema>;
export type SignupData = z.output<typeof signupSchema>;
