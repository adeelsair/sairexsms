import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { getOrCreateDailyPrincipalBrief } from "@/lib/insights/principal-brief.service";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const brief = await getOrCreateDailyPrincipalBrief(ctx.organizationId);
    return NextResponse.json(brief);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load principal brief";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
