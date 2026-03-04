/**
 * Security Hardening Utilities
 *
 * Production guardrails for tenant isolation, replay protection,
 * and webhook timestamp validation.
 */
import { NextResponse } from "next/server";

/* ── Tenant Ownership Assertion ───────────────────────── */

/**
 * Hard guard: ensures a resource belongs to the caller's organization.
 * Use in any API route that fetches data by resource ID.
 *
 * Returns a 403 NextResponse on mismatch, or null if safe.
 */
export function assertOwnership(
  guardOrganizationId: string,
  resourceOrganizationId: string,
): NextResponse | null {
  if (guardOrganizationId !== resourceOrganizationId) {
    return NextResponse.json(
      { error: "Access denied: resource does not belong to your organization" },
      { status: 403 },
    );
  }
  return null;
}

/* ── Webhook Replay Protection ────────────────────────── */

const recentWebhookIds = new Map<string, number>();

let webhookCleanupScheduled = false;
function scheduleWebhookCleanup() {
  if (webhookCleanupScheduled) return;
  webhookCleanupScheduled = true;
  setTimeout(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, ts] of recentWebhookIds) {
      if (ts < cutoff) recentWebhookIds.delete(id);
    }
    webhookCleanupScheduled = false;
  }, 60_000);
}

/**
 * Prevents replay attacks on webhook endpoints.
 * Tracks seen webhook IDs for a 10-minute window.
 *
 * Returns true if the webhook is a replay (already processed).
 */
export function isWebhookReplay(webhookId: string): boolean {
  if (recentWebhookIds.has(webhookId)) return true;

  recentWebhookIds.set(webhookId, Date.now());
  scheduleWebhookCleanup();
  return false;
}

/**
 * Validates that a webhook timestamp is within an acceptable window.
 * Rejects payloads older than maxAgeSeconds (default: 5 minutes).
 */
export function isWebhookTimestampValid(
  timestampSeconds: number,
  maxAgeSeconds = 300,
): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const delta = Math.abs(nowSeconds - timestampSeconds);
  return delta <= maxAgeSeconds;
}

/* ── Security Headers ─────────────────────────────────── */

/**
 * Returns recommended security headers for API responses.
 * Apply in Next.js middleware or via next.config headers.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
