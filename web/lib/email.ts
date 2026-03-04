import nodemailer from "nodemailer";

/**
 * Shared SMTP transport used by all email-sending features
 * (invitations, email verification, password reset, etc.)
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.titan.email",
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email via the shared transporter.
 * Wraps nodemailer sendMail with default "from" and error logging.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "SAIREX SMS"}" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

/**
 * Send email verification link to a newly registered user.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Verify your email — SAIREX SMS",
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
