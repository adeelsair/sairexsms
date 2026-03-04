import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import { prisma } from "@/lib/prisma";
import { readSessionTokenFromCookieHeader } from "@/lib/auth/session-cookie";

/**
 * POST /api/superadmin/exit-impersonation
 * Clears impersonation context directly on session row.
 */
export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;

  if (!guard.impersonation || !guard.impersonationTenantId || !guard.impersonationOriginalUserId) {
    return NextResponse.json(
      { ok: false, error: "No active impersonation session" },
      { status: 400 },
    );
  }

  const sessionToken = readSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (!sessionToken) {
    return NextResponse.json(
      { ok: false, error: "Session token not found" },
      { status: 401 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
  });
  if (!session || session.userId !== guard.id) {
    return NextResponse.json(
      { ok: false, error: "Session not found" },
      { status: 401 },
    );
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      impersonation: false,
      organizationId: session.originalOrganizationId ?? session.organizationId,
      campusId: session.originalCampusId ?? null,
      membershipId: session.originalMembershipId ?? null,
      organizationStructure:
        session.originalOrganizationStructure ?? session.organizationStructure,
      unitPath: session.originalUnitPath ?? null,
      role: session.originalRole ?? session.role,
      platformRole: session.originalPlatformRole ?? session.platformRole,
      impersonationOriginalUserId: null,
      impersonationEffectiveUserId: null,
      impersonationTenantId: null,
      impersonationExpiresAt: null,
      originalOrganizationId: null,
      originalCampusId: null,
      originalMembershipId: null,
      originalOrganizationStructure: null,
      originalUnitPath: null,
      originalRole: null,
      originalPlatformRole: null,
    },
  });

  const audit = resolveAuditActor(guard);
  await prisma.domainEventLog.create({
    data: {
      organizationId: guard.impersonationTenantId,
      eventType: "IMPERSONATION_END",
      payload: {
        originalUserId: guard.impersonationOriginalUserId,
        impersonatedTenantId: guard.impersonationTenantId,
        _audit: {
          actorUserId: audit.actorUserId,
          effectiveUserId: audit.effectiveUserId,
          tenantId: guard.impersonationTenantId,
          impersonation: true,
          impersonatedTenantId: guard.impersonationTenantId,
        },
      },
      occurredAt: new Date(),
      initiatedByUserId: audit.actorUserId,
      processed: true,
    },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("sx_impersonation");
  return response;
}
