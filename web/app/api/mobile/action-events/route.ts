import { NextResponse } from "next/server";

import {
  ACTION_UPDATED_EVENT,
  actionEventBus,
  type ActionUpdatedPayload,
} from "@/lib/events/action-events";
import { getRequestContext } from "@/lib/auth/getRequestContext";

export const runtime = "nodejs";

function toSse(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const encoder = new TextEncoder();

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let handler: ((payload: ActionUpdatedPayload) => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(toSse("connected", { ok: true })));

        handler = (payload) => {
          if (payload.orgId !== ctx.organizationId) return;
          controller.enqueue(
            encoder.encode(
              toSse("ACTION_REFRESH", {
                orgId: payload.orgId,
                type: payload.type,
                at: new Date().toISOString(),
              }),
            ),
          );
        };

        actionEventBus.on(ACTION_UPDATED_EVENT, handler);

        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 20000);
      },
      cancel() {
        if (handler) {
          actionEventBus.off(ACTION_UPDATED_EVENT, handler);
        }
        if (heartbeat) {
          clearInterval(heartbeat);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to subscribe action events";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
