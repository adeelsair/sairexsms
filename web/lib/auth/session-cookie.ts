import { cookies } from "next/headers";

const CANDIDATE_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

export function resolveSessionCookieName() {
  const baseUrl =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "";
  const canUseSecurePrefix =
    process.env.NODE_ENV === "production" &&
    /^https:\/\//i.test(baseUrl);

  return canUseSecurePrefix
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;

  const pairs = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const cookieMap = new Map<string, string>();
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookieMap.set(name, value);
  }

  for (const name of CANDIDATE_COOKIE_NAMES) {
    const token = cookieMap.get(name);
    if (token) return token;
  }

  return null;
}

export async function readSessionTokenFromRequestCookies() {
  const cookieStore = await cookies();
  for (const name of CANDIDATE_COOKIE_NAMES) {
    const token = cookieStore.get(name)?.value;
    if (token) return token;
  }
  return null;
}
