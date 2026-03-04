import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { getStudentStabilityOverview } from "@/lib/insights/student-stability.service";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const { searchParams } = new URL(request.url);
    const thresholdParam = searchParams.get("threshold");
    const threshold = thresholdParam ? Number(thresholdParam) : undefined;

    const data = await getStudentStabilityOverview({
      organizationId: ctx.organizationId,
      campusId: ctx.campusId ? Number(ctx.campusId) : undefined,
      stabilityThreshold: Number.isFinite(threshold ?? NaN)
        ? threshold
        : undefined,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load student stability insights";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
