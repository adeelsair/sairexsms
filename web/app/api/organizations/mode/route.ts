import { NextResponse } from "next/server";
import { z } from "zod";

import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import {
  resolveOrganizationMode,
  updateOrganizationMode,
  type OrganizationMode,
} from "@/lib/system/mode.service";

const updateModeSchema = z.object({
  mode: z.enum(["SIMPLE", "PRO"]),
});

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const organizationId = guard.organizationId;
    if (!organizationId && isSuperAdmin(guard)) {
      return NextResponse.json({
        organizationId: null,
        mode: "PRO",
        isSimple: false,
        isSuperAdmin: true,
      });
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const resolved = await resolveOrganizationMode(organizationId);
    return NextResponse.json({
      organizationId,
      mode: resolved.mode,
      isSimple: resolved.isSimple,
      isSuperAdmin: isSuperAdmin(guard),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve organization mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = updateModeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const organizationId = guard.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const mode = await updateOrganizationMode(
      organizationId,
      parsed.data.mode as OrganizationMode,
    );
    return NextResponse.json({ ok: true, organizationId, mode });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update organization mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
