import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSessionCookieName } from "@/lib/auth/session-cookie";
import { resolveSessionContext } from "@/lib/auth/session-context";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function issueSessionForUserId(
  userId: number,
  preferredOrganizationId?: string | null,
) {
  let context = await resolveSessionContext(userId, preferredOrganizationId);

  // Fallback path: if tenant context cannot be resolved (or membership data is
  // inconsistent in a deployed environment), still issue a minimal platform
  // session so login does not hard-fail. Session callback can enrich later.
  if (!context) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        isActive: true,
        platformRole: true,
      },
    });

    if (!user || !user.isActive) return null;

    context = {
      userId: user.id,
      email: user.email ?? user.phone ?? "",
      name: user.name ?? user.email ?? user.phone ?? "",
      platformRole: user.platformRole ?? null,
      role: null,
      organizationId: null,
      campusId: null,
      membershipId: null,
      organizationStructure: null,
      unitPath: null,
    };
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: context.userId,
      expires,
      organizationId: context.organizationId,
      campusId: context.campusId,
      membershipId: context.membershipId,
      organizationStructure: context.organizationStructure,
      unitPath: context.unitPath,
      role: context.role,
      platformRole: context.platformRole,
      impersonation: false,
    },
  });

  return {
    sessionToken,
    expires,
    context,
  };
}

export function attachSessionCookie(response: NextResponse, sessionToken: string, expires: Date) {
  const cookieName = resolveSessionCookieName();
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
    sameSite: "lax",
    path: "/",
    expires,
  });
  response.cookies.delete("sx_impersonation");
}
