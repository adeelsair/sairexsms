import { NextResponse } from "next/server";
import { updateDeliveryStatus } from "@/lib/finance/reminder-engine.service";

/**
 * POST /api/webhooks/whatsapp
 *
 * Public endpoint — receives delivery status updates from
 * WhatsApp Cloud API. Updates ReminderLog accordingly.
 *
 * WhatsApp sends statuses: sent, delivered, read, failed.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const statuses = changes?.value?.statuses;

    if (!Array.isArray(statuses)) {
      return NextResponse.json({ received: true });
    }

    for (const status of statuses) {
      const externalRef = status.id as string;
      const waStatus = String(status.status).toLowerCase();

      if (!externalRef) continue;

      if (waStatus === "delivered") {
        await updateDeliveryStatus(externalRef, "DELIVERED");
      } else if (waStatus === "read") {
        await updateDeliveryStatus(externalRef, "READ");
      } else if (waStatus === "failed") {
        await updateDeliveryStatus(externalRef, "FAILED");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    return NextResponse.json({ received: false }, { status: 400 });
  }
}

/**
 * GET /api/webhooks/whatsapp
 *
 * WhatsApp Cloud API verification challenge.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}
