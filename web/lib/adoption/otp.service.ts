/**
 * Passwordless Phone Auth — OTP Service
 *
 * Handles OTP generation, hashing, verification, rate-limiting,
 * and session cleanup. Integrates with the existing queue system
 * for SMS/WhatsApp delivery.
 */
import { prisma } from "@/lib/prisma";
import { createHash, randomInt } from "crypto";
import { enqueue, OTP_QUEUE } from "@/lib/queue";

/* ── Config ────────────────────────────────────────────── */

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTPS_PER_PHONE = 3;
const MAX_OTPS_PER_IP = 10;

/* ── Errors ────────────────────────────────────────────── */

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "RATE_LIMITED"
      | "EXPIRED"
      | "INVALID"
      | "CONSUMED"
      | "TOO_MANY_ATTEMPTS"
      | "NOT_FOUND" = "INVALID",
  ) {
    super(message);
    this.name = "OtpError";
  }
}

/* ── Helpers ───────────────────────────────────────────── */

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return String(randomInt(min, max + 1));
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/^0/, "+92");
}

/* ── Request OTP ───────────────────────────────────────── */

export interface RequestOtpInput {
  phone: string;
  channel?: "mobile" | "whatsapp";
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestOtpResult {
  otpSessionId: string;
  expiresAt: Date;
  channel: "mobile" | "whatsapp";
}

export async function requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
  const phone = normalizePhone(input.phone);
  const channel = input.channel ?? "mobile";
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const phoneCount = await prisma.otpSession.count({
    where: { phone, createdAt: { gte: windowStart } },
  });

  if (phoneCount >= MAX_OTPS_PER_PHONE) {
    throw new OtpError(
      "Too many OTP requests for this number. Please wait before trying again.",
      "RATE_LIMITED",
    );
  }

  if (input.ipAddress) {
    const ipCount = await prisma.otpSession.count({
      where: { ipAddress: input.ipAddress, createdAt: { gte: windowStart } },
    });

    if (ipCount >= MAX_OTPS_PER_IP) {
      throw new OtpError(
        "Too many OTP requests from this device. Please wait before trying again.",
        "RATE_LIMITED",
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const session = await prisma.otpSession.create({
    data: {
      phone,
      codeHash: hashCode(code),
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  await enqueue({
    type: "OTP",
    queue: OTP_QUEUE,
    payload: {
      channel,
      target: phone,
      code,
    },
  });

  return {
    otpSessionId: session.id,
    expiresAt,
    channel,
  };
}

/* ── Verify OTP ────────────────────────────────────────── */

export interface VerifyOtpInput {
  otpSessionId: string;
  code: string;
}

export interface VerifyOtpResult {
  phone: string;
  userId: number;
  isNewUser: boolean;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const session = await prisma.otpSession.findUnique({
    where: { id: input.otpSessionId },
  });

  if (!session) {
    throw new OtpError("OTP session not found", "NOT_FOUND");
  }

  if (session.consumed) {
    throw new OtpError("This OTP has already been used", "CONSUMED");
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new OtpError(
      "Too many failed attempts. Please request a new OTP.",
      "TOO_MANY_ATTEMPTS",
    );
  }

  if (new Date() > session.expiresAt) {
    throw new OtpError("OTP has expired. Please request a new one.", "EXPIRED");
  }

  const codeValid = hashCode(input.code) === session.codeHash;

  if (!codeValid) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpError("Invalid OTP code", "INVALID");
  }

  await prisma.otpSession.update({
    where: { id: session.id },
    data: { consumed: true },
  });

  const { user, isNewUser } = await findOrCreatePhoneUser(session.phone);

  return {
    phone: session.phone,
    userId: user.id,
    isNewUser,
  };
}

/* ── User Resolution ───────────────────────────────────── */

async function findOrCreatePhoneUser(phone: string): Promise<{
  user: { id: number; email: string | null; name: string | null; phone: string | null };
  isNewUser: boolean;
}> {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, email: true, name: true, phone: true },
  });

  if (existing) {
    if (!existing.phone) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isPhoneVerified: true },
      });
    }
    return { user: existing, isNewUser: false };
  }

  const newUser = await prisma.user.create({
    data: {
      phone,
      isPhoneVerified: true,
      isActive: true,
    },
    select: { id: true, email: true, name: true, phone: true },
  });

  return { user: newUser, isNewUser: true };
}

/* ── Cleanup ───────────────────────────────────────────── */

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.otpSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumed: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}
