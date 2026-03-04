import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { getTodayActions } from "@/lib/mobile/mobile-actions.service";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const data = await getTodayActions(ctx.organizationId, {
      id: ctx.userId,
      role: ctx.role,
      campusId: ctx.campusId,
    });
    return NextResponse.json({
      ...data,
      meta: {
        ...data.meta,
        userName: ctx.userName,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load today's actions";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
