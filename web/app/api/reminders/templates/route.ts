import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  getMessageTemplates,
  upsertMessageTemplate,
} from "@/lib/finance/reminder-engine.service";
import type { ReminderChannel } from "@/lib/generated/prisma";

/**
 * GET /api/reminders/templates?channel=WHATSAPP
 *
 * List message templates for the organization.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId && !isSuperAdmin(guard)) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") as ReminderChannel | null;

    const templates = await getMessageTemplates(orgId!, channel ?? undefined);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[Templates] List error:", err);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

/**
 * POST /api/reminders/templates
 *
 * Create or update a message template.
 *
 * Body: { channel, templateKey, name, content, isDefault? }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { channel, templateKey, name, content, isDefault } = body;

    if (!channel || !templateKey || !name || !content) {
      return NextResponse.json(
        { error: "channel, templateKey, name, and content are required" },
        { status: 400 },
      );
    }

    const template = await upsertMessageTemplate({
      organizationId: orgId,
      channel,
      templateKey,
      name,
      content,
      isDefault,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("[Templates] Upsert error:", err);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
