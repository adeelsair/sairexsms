import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { enqueue, OTP_QUEUE } from "@/lib/queue";
import { sendOtpEmail } from "@/lib/email";
import { sendSmsMessage } from "@/lib/sms";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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

    const isDev = process.env.NODE_ENV === "development";

    // In development, send email or SMS synchronously so the code is delivered without needing the OTP worker.
    if (channel === "email" && isDev) {
      const sent = await sendOtpEmail(target, code);
      return NextResponse.json({
        sent,
        expiresInSeconds: 600,
        maxAttempts: MAX_ATTEMPTS,
        ...(isDev ? { devCode: code } : {}),
      });
    }

    if (channel === "mobile" && isDev) {
      let sent = false;
      let smsConfigHint: string | undefined;
      try {
        const msg = `Your SAIREX SMS verification code is: ${code}. Valid for 10 minutes.`;
        await sendSmsMessage(target, msg);
        sent = true;
      } catch (smsErr) {
        const errMsg = smsErr instanceof Error ? smsErr.message : "";
        if (errMsg.includes("VEEVO_HASH") || errMsg.includes("VEEVO_SENDER") || errMsg.includes("missing") || errMsg.includes("SMSMOBILE_API_KEY")) {
          console.log(`[Verify Send] DEV — SMS not configured; code for ${target}: ${code}`);
          smsConfigHint = "Set VEEVO_HASH and VEEVO_SENDER (or SMSMOBILE_API_KEY) in web/.env, then restart dev server.";
        } else if (errMsg.includes("AUTH_FAILED") || errMsg.includes("Veevo SMS failed")) {
          smsConfigHint = "Veevo credentials invalid. Check VEEVO_HASH and VEEVO_SENDER in web/.env and restart dev server.";
        } else {
          console.error("[Verify Send] SMS error:", smsErr);
          smsConfigHint = "Check SMS config in web/.env and restart the dev server.";
        }
      }
      return NextResponse.json({
        sent,
        expiresInSeconds: 600,
        maxAttempts: MAX_ATTEMPTS,
        ...(isDev ? { devCode: code } : {}),
        ...(smsConfigHint ? { smsConfigHint } : {}),
      });
    }

    if (channel === "whatsapp" && isDev) {
      let sent = false;
      let whatsAppConfigHint: string | undefined;
      try {
        await sendWhatsAppMessage(target, `Your SAIREX SMS verification code is: ${code}. Valid for 10 minutes.`);
        sent = true;
      } catch (waErr) {
        const errMsg = waErr instanceof Error ? waErr.message : "";
        console.error("[Verify Send] WhatsApp error:", waErr);
        if (errMsg.includes("VEEVO_HASH") || errMsg.includes("required")) {
          whatsAppConfigHint = "Set WHATSAPP_PROVIDER=veevo and VEEVO_HASH in web/.env, then restart dev server.";
        } else {
          whatsAppConfigHint = errMsg.length > 80 ? `WhatsApp failed. Use the code below. (${errMsg.slice(0, 80)}…)` : `WhatsApp failed: ${errMsg}`;
        }
      }
      return NextResponse.json({
        sent,
        expiresInSeconds: 600,
        maxAttempts: MAX_ATTEMPTS,
        ...(isDev ? { devCode: code } : {}),
        ...(whatsAppConfigHint ? { whatsAppConfigHint } : {}),
      });
    }

    // ── Dispatch OTP via background queue ──
    await enqueue({
      type: "OTP",
      queue: OTP_QUEUE,
      userId: guard.id,
      payload: { channel, target, code },
    });

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
