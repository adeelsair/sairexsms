import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { enqueue, OTP_QUEUE } from "@/lib/queue";

const CHANNELS = ["email", "mobile", "whatsapp"] as const;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const sendSchema = z.object({
  channel: z.enum(CHANNELS),
  target: z.string().min(3, "Target is required"),
});

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * POST /api/onboarding/verify/send
 *
 * Generates a 6-digit OTP (crypto-secure), stores its SHA-256 hash,
 * and dispatches the plaintext code via the appropriate channel.
 * In development mode the code is also returned in the response.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { channel, target } = parsed.data;

    // Check if the user is currently locked out for this channel+target
    const locked = await prisma.verificationCode.findFirst({
      where: {
        userId: guard.id,
        channel,
        target,
        lockedUntil: { gt: new Date() },
      },
    });

    if (locked) {
      const waitMinutes = Math.ceil(
        (locked.lockedUntil!.getTime() - Date.now()) / 60_000,
      );
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${waitMinutes} minute(s).` },
        { status: 429 },
      );
    }

    // Rate-limit: max 1 code per channel+target per 60 seconds
    const recent = await prisma.verificationCode.findFirst({
      where: {
        userId: guard.id,
        channel,
        target,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      const waitSeconds = Math.ceil(
        (recent.createdAt.getTime() + 60_000 - Date.now()) / 1000,
      );
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before requesting a new code` },
        { status: 429 },
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 minutes

    await prisma.verificationCode.create({
      data: {
        userId: guard.id,
        channel,
        target,
        codeHash: hashOtp(code),
        expiresAt,
      },
    });

    // ── Dispatch OTP via background queue ──
    await enqueue({
      type: "OTP",
      queue: OTP_QUEUE,
      userId: guard.id,
      payload: { channel, target, code },
    });

    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json({
      sent: true,
      expiresInSeconds: 600,
      maxAttempts: MAX_ATTEMPTS,
      ...(isDev ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("Verify send error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 },
    );
  }
}
