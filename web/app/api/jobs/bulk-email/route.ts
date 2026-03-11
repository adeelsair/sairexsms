import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, EMAIL_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject is too long"),
  message: z.string().min(1, "Message is required").max(5000, "Message is too long"),
  recipients: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().email("Invalid email address"),
      }),
    )
    .min(1, "At least one recipient is required")
    .max(5000, "Maximum 5000 recipients per batch"),
});

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(message: string): string {
  return `<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`;
}

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
    const html = textToHtml(parsed.data.message);

    const jobIds = await Promise.all(
      parsed.data.recipients.map((recipient) =>
        enqueue({
          type: "EMAIL",
          queue: EMAIL_QUEUE,
          userId: guard.id,
          organizationId: orgId,
          payload: {
            to: recipient.email,
            subject: parsed.data.subject,
            html,
          },
        }),
      ),
    );

    return NextResponse.json(
      { jobIds, message: `Bulk email queued for ${jobIds.length} recipients` },
      { status: 202 },
    );
  } catch (error) {
    console.error("Bulk email job error:", error);
    return NextResponse.json({ error: "Failed to queue bulk email" }, { status: 500 });
  }
}

