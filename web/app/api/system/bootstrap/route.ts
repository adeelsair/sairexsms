import { NextResponse } from "next/server";
import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import { bootstrapDemoDataIfEmpty } from "@/lib/bootstrap/demo-seed.service";

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await bootstrapDemoDataIfEmpty(orgId, {
      isDemoMode: body.isDemoMode === true,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap demo data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

