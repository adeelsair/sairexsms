import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import { prisma } from "@/lib/prisma";
import { readSessionTokenFromCookieHeader } from "@/lib/auth/session-cookie";

interface ImpersonationStartResponse {
  ok: boolean;
  data?: {
    tenantId: string;
    tenantName: string;
    expiresAt: string;
  };
  error?: string;
}

interface TenantOption {
  id: string;
  name: string;
}

/**
 * GET /api/superadmin/impersonate
 * Lists active tenants for super admin impersonation selector.
 */
export async function GET(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;

  if (!isSuperAdmin(guard)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const organizations = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      organizationName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const tenants: TenantOption[] = organizations.map((org) => ({
    id: org.id,
    name: org.displayName || org.organizationName,
  }));

  return NextResponse.json({ ok: true, data: { tenants } });
}

/**
 * POST /api/superadmin/impersonate
 * Body: { targetId: string }
 */
export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;

  if (!isSuperAdmin(guard)) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Only SUPER_ADMIN can impersonate tenants" },
      { status: 403 },
    );
  }

  if (guard.impersonation) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Impersonation chaining is not allowed" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({})) as { targetId?: string };
  const targetId = body.targetId?.trim();
  if (!targetId) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "targetId is required" },
      { status: 400 },
    );
  }

  const tenant = await prisma.organization.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      status: true,
      displayName: true,
      organizationName: true,
    },
  });

  if (!tenant || tenant.status !== "ACTIVE") {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Target tenant not found or inactive" },
      { status: 404 },
    );
  }

  const hasAnotherSuperAdminInTenant = await prisma.user.findFirst({
    where: {
      id: { not: guard.id },
      platformRole: "SUPER_ADMIN",
      memberships: {
        some: {
          organizationId: tenant.id,
          status: "ACTIVE",
        },
      },
    },
    select: { id: true },
  });

  if (hasAnotherSuperAdminInTenant) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Cannot impersonate another SUPER_ADMIN context" },
      { status: 403 },
    );
  }

  let effectiveTenantActor = await prisma.membership.findFirst({
    where: {
      organizationId: tenant.id,
      status: "ACTIVE",
      user: {
        isActive: true,
        OR: [
          { platformRole: null },
          { platformRole: { not: "SUPER_ADMIN" } },
        ],
      },
    },
    select: {
      userId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!effectiveTenantActor) {
    const shadowEmail = `impersonation+${tenant.id.toLowerCase()}@sairex.local`;
    const shadowUser = await prisma.user.upsert({
      where: { email: shadowEmail },
      update: {
        isActive: true,
        platformRole: null,
        name: "Impersonation Context User",
      },
      create: {
        email: shadowEmail,
        name: "Impersonation Context User",
        isActive: true,
        platformRole: null,
      },
      select: { id: true },
    });

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: shadowUser.id,
          organizationId: tenant.id,
        },
      },
      update: {
        role: "ORG_ADMIN",
        status: "ACTIVE",
        campusId: null,
        unitId: null,
        unitPath: null,
      },
      create: {
        userId: shadowUser.id,
        organizationId: tenant.id,
        role: "ORG_ADMIN",
        status: "ACTIVE",
      },
    });

    effectiveTenantActor = { userId: shadowUser.id };
  }
  const sessionToken = readSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (!sessionToken) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Session token not found" },
      { status: 401 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
  });
  if (!session || session.userId !== guard.id) {
    return NextResponse.json<ImpersonationStartResponse>(
      { ok: false, error: "Session not found" },
      { status: 401 },
    );
  }

  const expiresAtDate = new Date(Date.now() + 60 * 1000);
  const expiresAt = expiresAtDate.toISOString();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      impersonation: true,
      impersonationOriginalUserId: guard.id,
      impersonationEffectiveUserId: effectiveTenantActor.userId,
      impersonationTenantId: tenant.id,
      impersonationExpiresAt: expiresAtDate,
      originalOrganizationId: guard.organizationId,
      originalCampusId: guard.campusId,
      originalMembershipId: guard.membershipId,
      originalOrganizationStructure: guard.organizationStructure,
      originalUnitPath: guard.unitPath,
      originalRole: guard.role,
      originalPlatformRole: guard.platformRole,
      organizationId: tenant.id,
      campusId: null,
      membershipId: null,
      organizationStructure: "SINGLE",
      unitPath: null,
      role: "ORG_ADMIN",
      platformRole: null,
    },
  });

  const audit = resolveAuditActor(guard);

  await prisma.domainEventLog.create({
    data: {
      organizationId: tenant.id,
      eventType: "IMPERSONATION_START",
      payload: {
        originalUserId: guard.id,
        impersonatedTenantId: tenant.id,
        _audit: {
          actorUserId: audit.actorUserId,
          effectiveUserId: audit.effectiveUserId,
          tenantId: tenant.id,
          impersonation: true,
          impersonatedTenantId: tenant.id,
        },
      },
      occurredAt: new Date(),
      initiatedByUserId: audit.actorUserId,
      processed: true,
    },
  });

  const response = NextResponse.json<ImpersonationStartResponse>({
    ok: true,
    data: {
      tenantId: tenant.id,
      tenantName: tenant.displayName || tenant.organizationName,
      expiresAt,
    },
  });
  response.cookies.set("sx_impersonation", "1", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAtDate,
  });
  return response;
}
