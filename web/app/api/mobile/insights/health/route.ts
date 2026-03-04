import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { getOperationalRiskInsight } from "@/lib/insights/operational-risk.service";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const data = await getOperationalRiskInsight(ctx.organizationId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load operational health";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
