import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";

const CHANNELS = ["email", "mobile", "whatsapp"] as const;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const confirmSchema = z.object({
  channel: z.enum(CHANNELS),
  target: z.string().min(3),
  code: z.string().length(6, "Code must be 6 digits"),
});

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * POST /api/onboarding/verify/confirm
 *
 * Validates the OTP by comparing SHA-256 hashes.
 * Tracks failed attempts and locks out after MAX_ATTEMPTS failures.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { channel, target, code } = parsed.data;

    // Find the most recent unexpired, unverified code for this user+channel+target
    const record = await prisma.verificationCode.findFirst({
      where: {
        userId: guard.id,
        channel,
        target,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { error: "No pending verification code. Please request a new one." },
        { status: 400 },
      );
    }

    // Check if locked out
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil(
        (record.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${waitMinutes} minute(s).` },
        { status: 429 },
      );
    }

    // Compare hashes
    const inputHash = hashOtp(code);

    if (inputHash !== record.codeHash) {
      const newAttempts = record.attempts + 1;
      const isLocked = newAttempts >= MAX_ATTEMPTS;

      await prisma.verificationCode.update({
        where: { id: record.id },
        data: {
          attempts: newAttempts,
          ...(isLocked
            ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
            : {}),
        },
      });

      if (isLocked) {
        return NextResponse.json(
          { error: `Too many failed attempts. Locked for ${LOCKOUT_MINUTES} minutes.` },
          { status: 429 },
        );
      }

      const remaining = MAX_ATTEMPTS - newAttempts;
      return NextResponse.json(
        { error: `Invalid code. ${remaining} attempt(s) remaining.` },
        { status: 400 },
      );
    }

    // Success — mark verified with timestamp
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Verify confirm error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 },
    );
  }
}
