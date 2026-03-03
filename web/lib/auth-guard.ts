import { auth } from "@/auth";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import {
  installTenantOverrideGuards,
  setTenantSecurityContext,
} from "@/lib/security/tenant-override-sanitizer";
import { prisma } from "@/lib/prisma";
import { readSessionTokenFromCookieHeader } from "@/lib/auth/session-cookie";

installTenantOverrideGuards();

const IMPERSONATION_BLOCKED_PREFIXES = [
  "/admin",
  "/superadmin",
  "/billing",
  "/api/billing",
  "/api/superadmin",
] as const;

const IMPERSONATION_ALLOWED_EXACT = new Set([
  "/api/superadmin/exit-impersonation",
]);

function shouldBlockDuringImpersonation(pathname: string): boolean {
  if (IMPERSONATION_ALLOWED_EXACT.has(pathname)) {
    return false;
  }

  return IMPERSONATION_BLOCKED_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function resolvePathname(request?: Request): string | null {
  if (request) {
    return new URL(request.url).pathname;
  }
  return null;
}

/**
 * Authenticated user shape extracted from the JWT session.
 * Resolved from the user's active Membership + platform role.
 */
export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  platformRole: string | null;
  role: string | null;
  organizationId: string | null;
  campusId: number | null;
  membershipId: number | null;
  organizationStructure: "SINGLE" | "MULTIPLE" | null;
  unitPath: string | null;
  impersonation: boolean;
  impersonationOriginalUserId: number | null;
  impersonationEffectiveUserId: number | null;
  impersonationTenantId: string | null;
  impersonationExpiresAt: number | null;
};

/**
 * Returns true if the user holds the SUPER_ADMIN platform role.
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.platformRole === "SUPER_ADMIN" && !user.impersonation;
}

/**
 * Verifies the session and returns the authenticated user,
 * or a 401/403 NextResponse if something is wrong.
 *
 * Requires an organizationId (or platformRole) — use for admin API routes.
 */
export async function requireAuth(request?: Request): Promise<AuthUser | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;

  const platformRole = (user.platformRole as string) ?? null;
  const organizationId = user.organizationId ? String(user.organizationId) : null;
  const parsedUserId = Number(user.id);
  const email = typeof user.email === "string" ? user.email : "";

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0 || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const impersonation = Boolean(user.impersonation);
  const impersonationExpiresAt = user.impersonationExpiresAt
    ? Number(user.impersonationExpiresAt)
    : null;
  if (
    impersonation &&
    impersonationExpiresAt &&
    Number.isFinite(impersonationExpiresAt) &&
    impersonationExpiresAt <= Date.now()
  ) {
    const token = request
      ? readSessionTokenFromCookieHeader(request.headers.get("cookie"))
      : null;
    if (token) {
      await prisma.session.deleteMany({ where: { sessionToken: token } });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathname = resolvePathname(request);
  if (impersonation && pathname && shouldBlockDuringImpersonation(pathname)) {
    return new NextResponse("Forbidden during impersonation", { status: 403 });
  }

  if (!organizationId && !platformRole) {
    return NextResponse.json(
      { error: "No organization assigned to this account. Please complete onboarding first." },
      { status: 403 },
    );
  }

  const orgStructure = (user.organizationStructure as string) ?? null;

  const userId = parsedUserId;
  const name = typeof user.name === "string" ? user.name : null;
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

  setTenantSecurityContext({ userId, ip });

  Sentry.setUser({ id: String(userId), email });
  if (organizationId) Sentry.setTag("orgId", organizationId);
  if (platformRole) Sentry.setTag("platformRole", platformRole);

  return {
    id: userId,
    email,
    name,
    platformRole,
    role: (user.role as string) ?? null,
    organizationId,
    campusId: user.campusId ? Number(user.campusId) : null,
    membershipId: user.membershipId ? Number(user.membershipId) : null,
    organizationStructure: orgStructure === "SINGLE" || orgStructure === "MULTIPLE" ? orgStructure : null,
    unitPath: (user.unitPath as string) ?? null,
    impersonation,
    impersonationOriginalUserId: user.impersonationOriginalUserId
      ? Number(user.impersonationOriginalUserId)
      : null,
    impersonationEffectiveUserId: user.impersonationEffectiveUserId
      ? Number(user.impersonationEffectiveUserId)
      : null,
    impersonationTenantId: user.impersonationTenantId
      ? String(user.impersonationTenantId)
      : null,
    impersonationExpiresAt,
  };
}

/**
 * Lighter auth check for onboarding routes.
 * Only requires a verified, logged-in user — no organization needed.
 */
export async function requireVerifiedAuth(request?: Request): Promise<AuthUser | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;
  const orgStructure = (user.organizationStructure as string) ?? null;
  const impersonation = Boolean(user.impersonation);
  const impersonationExpiresAt = user.impersonationExpiresAt
    ? Number(user.impersonationExpiresAt)
    : null;
  if (
    impersonation &&
    impersonationExpiresAt &&
    Number.isFinite(impersonationExpiresAt) &&
    impersonationExpiresAt <= Date.now()
  ) {
    const token = request
      ? readSessionTokenFromCookieHeader(request.headers.get("cookie"))
      : null;
    if (token) {
      await prisma.session.deleteMany({ where: { sessionToken: token } });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pathname = resolvePathname(request);
  if (impersonation && pathname && shouldBlockDuringImpersonation(pathname)) {
    return new NextResponse("Forbidden during impersonation", { status: 403 });
  }
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userId = parseInt(user.id as string, 10);
  setTenantSecurityContext({ userId, ip });

  return {
    id: userId,
    email: user.email as string,
    name: typeof user.name === "string" ? user.name : null,
    platformRole: (user.platformRole as string) ?? null,
    role: (user.role as string) ?? null,
    organizationId: user.organizationId ? String(user.organizationId) : null,
    campusId: user.campusId ? Number(user.campusId) : null,
    membershipId: user.membershipId ? Number(user.membershipId) : null,
    organizationStructure: orgStructure === "SINGLE" || orgStructure === "MULTIPLE" ? orgStructure : null,
    unitPath: (user.unitPath as string) ?? null,
    impersonation,
    impersonationOriginalUserId: user.impersonationOriginalUserId
      ? Number(user.impersonationOriginalUserId)
      : null,
    impersonationEffectiveUserId: user.impersonationEffectiveUserId
      ? Number(user.impersonationEffectiveUserId)
      : null,
    impersonationTenantId: user.impersonationTenantId
      ? String(user.impersonationTenantId)
      : null,
    impersonationExpiresAt,
  };
}

/**
 * Checks if the user has one of the allowed roles.
 * Checks both platformRole and membership role.
 * Returns a 403 NextResponse if not, or null if allowed.
 */
export function requireRole(
  user: AuthUser,
  ...allowedRoles: string[]
): NextResponse | null {
  if (user.platformRole && allowedRoles.includes(user.platformRole)) {
    return null;
  }

  if (user.role && allowedRoles.includes(user.role)) {
    return null;
  }

  return NextResponse.json(
    { error: `Forbidden — requires one of: ${allowedRoles.join(", ")}` },
    { status: 403 },
  );
}
