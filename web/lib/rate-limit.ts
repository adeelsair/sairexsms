/**
 * In-Memory Rate Limiter
 *
 * Sliding-window counters with automatic cleanup.
 * Use for API routes, OTP requests, webhook endpoints, and login attempts.
 *
 * For multi-instance deployments, swap the in-memory store
 * with Redis-backed counters via getRedisConnection().
 */
import { NextResponse } from "next/server";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
    cleanupScheduled = false;
  }, 60_000);
}

/* ── Core Rate Limit Function ─────────────────────────── */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    scheduleCleanup();
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= config.max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetAt: entry.resetAt,
  };
}

/* ── Pre-Built Limiters ───────────────────────────────── */

export const RATE_LIMITS = {
  API_GENERAL: { max: 100, windowSeconds: 60 } as RateLimitConfig,
  OTP_REQUEST: { max: 5, windowSeconds: 300 } as RateLimitConfig,
  OTP_VERIFY: { max: 10, windowSeconds: 300 } as RateLimitConfig,
  LOGIN_ATTEMPT: { max: 10, windowSeconds: 300 } as RateLimitConfig,
  WEBHOOK: { max: 200, windowSeconds: 60 } as RateLimitConfig,
  QR_RESOLVE: { max: 60, windowSeconds: 60 } as RateLimitConfig,
  PAYMENT_INITIATE: { max: 20, windowSeconds: 60 } as RateLimitConfig,
} as const;

/* ── IP Extraction Helper ─────────────────────────────── */

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const real = request.headers.get("x-real-ip");
  return real || "unknown";
}

/* ── API Route Guard ──────────────────────────────────── */

/**
 * Apply rate limiting inside an API route.
 * Returns a 429 NextResponse if the limit is exceeded, or null if allowed.
 *
 * Usage:
 *   const blocked = applyRateLimit(request, "api", RATE_LIMITS.API_GENERAL);
 *   if (blocked) return blocked;
 */
export function applyRateLimit(
  request: Request,
  prefix: string,
  config: RateLimitConfig,
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${prefix}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds ?? 60),
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}

/**
 * Tenant-scoped rate limiting — limits per organization + IP.
 */
export function applyTenantRateLimit(
  request: Request,
  organizationId: string,
  prefix: string,
  config: RateLimitConfig,
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${prefix}:${organizationId}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds ?? 60),
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}
