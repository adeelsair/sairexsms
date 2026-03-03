import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import { resetDemoSchool } from "@/lib/demo/demo-generator.service";

const resetSchema = z.object({});

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = await resetDemoSchool(guard.id, guard.organizationId ?? undefined);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reset demo school";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
