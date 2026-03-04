import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateDemoSchool } from "@/lib/demo/demo-generator.service";

export async function POST() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const data = await generateDemoSchool(guard.id);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate demo school";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
