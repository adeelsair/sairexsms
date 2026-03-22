/**
 * Canonical URL for the public marketing landing site.
 * SairexSMS brand logos link here from app entry, admin, auth, and onboarding.
 *
 * Override with NEXT_PUBLIC_MARKETING_SITE_URL (no trailing slash).
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

const fromEnv =
  typeof process.env.NEXT_PUBLIC_MARKETING_SITE_URL === "string"
    ? process.env.NEXT_PUBLIC_MARKETING_SITE_URL.trim()
    : "";

/** Resolved origin/path for marketing — never empty in production builds. */
export const MARKETING_SITE_HREF = stripTrailingSlash(fromEnv || "https://sairex-sms.com");

export function marketingHrefIsAbsoluteHttp(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
