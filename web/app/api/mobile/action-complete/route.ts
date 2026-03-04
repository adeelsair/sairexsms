import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { emitActionUpdated } from "@/lib/events/action-events";
import { markMobileActionCompleted } from "@/lib/mobile/mobile-actions.service";

const actionCompleteSchema = z.object({
  actionKey: z.string().min(1),
});

function inferActionTypeFromKey(
  actionKey: string,
):
  | "FEE_COLLECTION"
  | "ABSENT_FOLLOWUP"
  | "STAFF_ATTENDANCE"
  | "ADMISSION_ENQUIRY"
  | "APPROVAL_PENDING"
  | "RESULT_PUBLISH"
  | "EXPENSE_APPROVAL" {
  if (actionKey.startsWith("fee_due") || actionKey.startsWith("completed_collection")) {
    return "FEE_COLLECTION";
  }
  if (actionKey.startsWith("absent_")) {
    return "ABSENT_FOLLOWUP";
  }
  if (actionKey.startsWith("completed_attendance")) {
    return "STAFF_ATTENDANCE";
  }
  if (actionKey.startsWith("admission_")) {
    return "ADMISSION_ENQUIRY";
  }
  return "APPROVAL_PENDING";
}

export async function POST(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const body = await request.json();
    const parsed = actionCompleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await markMobileActionCompleted({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      actionKey: parsed.data.actionKey,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    emitActionUpdated({
      orgId: ctx.organizationId,
      type: inferActionTypeFromKey(parsed.data.actionKey),
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to mark mobile action complete";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
