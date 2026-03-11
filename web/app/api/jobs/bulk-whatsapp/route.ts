import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, WHATSAPP_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
  recipients: z
    .array(
      z.object({
        name: z.string().optional(),
        phone: z.string().min(7, "Phone must be at least 7 digits"),
      }),
    )
    .min(1, "At least one recipient is required")
    .max(5000, "Maximum 5000 recipients per batch"),
});

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const orgId = resolveOrgId(guard);
    const jobIds = await Promise.all(
      parsed.data.recipients.map((recipient) => {
        const personalized = recipient.name
          ? parsed.data.message.replace(/\{name\}/gi, recipient.name)
          : parsed.data.message;

        return enqueue({
          type: "WHATSAPP",
          queue: WHATSAPP_QUEUE,
          userId: guard.id,
          organizationId: orgId,
          payload: {
            to: recipient.phone,
            message: personalized,
          },
        });
      }),
    );

    return NextResponse.json(
      { jobIds, message: `Bulk WhatsApp queued for ${jobIds.length} recipients` },
      { status: 202 },
    );
  } catch (error) {
    console.error("Bulk WhatsApp job error:", error);
    return NextResponse.json({ error: "Failed to queue bulk WhatsApp" }, { status: 500 });
  }
}

