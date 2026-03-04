import { NextResponse } from "next/server";
import { getDailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { getRequestContext } from "@/lib/auth/getRequestContext";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const data = await getDailyOperationsSnapshot(ctx);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Organization context required"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
