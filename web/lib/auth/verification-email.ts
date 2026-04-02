import crypto from "crypto";
import { dispatchAuthEmail } from "@/lib/auth-email-delivery";

export async function sendVerificationEmail(
  toEmail: string,
  verifyToken: string,
  userId?: number,
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`;

  await dispatchAuthEmail({
    to: toEmail,
    subject: "Verify your email — SAIREX SMS",
    userId,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e40af;">SAIREX SMS</h2>
        <p>Thank you for registering. Please verify your email address to continue.</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Verify Email
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          This link expires in 24 hours. If you didn't create this account, ignore this email.
        </p>
      </div>
    `,
  });
}

export function newEmailVerificationToken(): { token: string; expiresAt: Date } {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}
