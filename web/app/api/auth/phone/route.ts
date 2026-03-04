import { NextResponse } from "next/server";
import { requestOtp, OtpError } from "@/lib/adoption/otp.service";
import { emit } from "@/lib/events";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/phone
 *
 * Step 1 of passwordless login: request an OTP for a phone number.
 * Also available at /api/auth/request-otp (alias).
 *
 * Body: { phone: string, channel?: "mobile" | "whatsapp" }
 * Returns: { otpSessionId, expiresAt, channel }
 */
export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:phone-request", RATE_LIMITS.OTP_REQUEST);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { phone, channel } = body;

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return NextResponse.json(
        { error: "A valid phone number is required" },
        { status: 400 },
      );
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined;

    const userAgent = request.headers.get("user-agent") ?? undefined;

    const result = await requestOtp({
      phone,
      channel: channel === "whatsapp" ? "whatsapp" : "mobile",
      ipAddress,
      userAgent,
    });

    emit("OtpRequested", "", {
      phone,
      channel: result.channel,
      otpSessionId: result.otpSessionId,
    }).catch(() => {});

    return NextResponse.json({
      otpSessionId: result.otpSessionId,
      expiresAt: result.expiresAt.toISOString(),
      channel: result.channel,
    });
  } catch (err) {
    if (err instanceof OtpError) {
      const status = err.code === "RATE_LIMITED" ? 429 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("[Auth Phone] OTP request error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
