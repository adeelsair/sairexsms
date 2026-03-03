import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { inviteMembershipSchema } from "@/lib/validations/membership-invite";
import { inviteMember } from "@/lib/services/membership.service";
import type { MembershipRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/audit/request-context";

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = inviteMembershipSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const orgId = guard.organizationId ?? "";
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    let orgStructure = guard.organizationStructure;
    if (isSuperAdmin(guard) && !orgStructure) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { organizationStructure: true },
      });
      orgStructure = org?.organizationStructure === "SINGLE" || org?.organizationStructure === "MULTIPLE"
        ? org.organizationStructure
        : null;
    }

    const reqCtx = getRequestContext(request);

    const result = await inviteMember({
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role as MembershipRole,
      unitId: parsed.data.unitId,
      session: guard,
      organizationStructure: orgStructure,
      inviterRole: isSuperAdmin(guard) ? "ORG_ADMIN" : guard.role,
      inviterUnitPath: isSuperAdmin(guard) ? null : guard.unitPath,
      actorUserId: guard.id,
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent,
    });

    return NextResponse.json({
      ok: true,
      data: {
        membershipId: result.membership.id,
        role: result.membership.role,
        unitPath: result.membership.unitPath,
        userCreated: result.userCreated,
        updated: result.updated,
      },
    }, { status: result.updated ? 200 : 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to invite member";

    if (
      message.includes("outside your scope") ||
      message.includes("does not allow") ||
      message.includes("belongs to another") ||
      message.includes("not available for single")
    ) {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    console.error("Membership invite error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to invite member" },
      { status: 500 },
    );
  }
}
