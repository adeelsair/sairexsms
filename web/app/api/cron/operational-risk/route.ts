import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import { runOperationalRiskSnapshotCron } from "@/lib/insights/operational-risk.service";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");

  if (cronSecret) {
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const guard = await requireAuth();
    if (guard instanceof NextResponse) return guard;

    const denied = requireRole(guard, "SUPER_ADMIN");
    if (denied) return denied;
  }

  try {
    const result = await runOperationalRiskSnapshotCron();
    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run operational risk snapshot";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
