import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import type { ReminderChannel, ReminderTriggerType } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, type AuthUser } from "@/lib/auth-guard";

const REMINDER_CHANNELS: ReminderChannel[] = ["SMS", "WHATSAPP", "EMAIL"];
const REMINDER_TRIGGER_TYPES: ReminderTriggerType[] = [
  "BEFORE_DUE",
  "AFTER_DUE",
  "PARTIAL_PAYMENT",
  "FINAL_NOTICE",
  "RECEIPT",
];

interface ReminderRulePatchBody {
  id?: string;
  isActive?: boolean;
  daysOffset?: number;
  channel?: ReminderChannel;
  templateKey?: string | null;
  triggerType?: ReminderTriggerType;
}

function resolveOrganizationId(user: AuthUser): string | null {
  return user.organizationId;
}

function isReminderChannel(value: unknown): value is ReminderChannel {
  return typeof value === "string" && REMINDER_CHANNELS.includes(value as ReminderChannel);
}

function isReminderTriggerType(value: unknown): value is ReminderTriggerType {
  return typeof value === "string" && REMINDER_TRIGGER_TYPES.includes(value as ReminderTriggerType);
}

/**
 * GET /api/reminder-rules
 *
 * List reminder rules for the authenticated tenant.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "REGION_ADMIN");
  if (denied) return denied;

  const orgId = resolveOrganizationId(guard);
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const rules = await prisma.reminderRule.findMany({
      where: { organizationId: orgId },
      orderBy: [{ triggerType: "asc" }, { daysOffset: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("[ReminderRules] List error:", error);
    return NextResponse.json({ error: "Failed to load reminder rules" }, { status: 500 });
  }
}

/**
 * PATCH /api/reminder-rules
 *
 * Body: { id, isActive?, daysOffset?, channel?, templateKey?, triggerType? }
 * Updates a reminder rule for the authenticated tenant.
 */
export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "REGION_ADMIN");
  if (denied) return denied;

  try {
    const body = (await request.json()) as ReminderRulePatchBody;
    const orgId = resolveOrganizationId(guard);

    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: Prisma.ReminderRuleUpdateManyMutationInput = {};

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
      }
      data.isActive = body.isActive;
    }

    if (body.daysOffset !== undefined) {
      if (typeof body.daysOffset !== "number" || Number.isNaN(body.daysOffset)) {
        return NextResponse.json({ error: "daysOffset must be a number" }, { status: 400 });
      }
      data.daysOffset = body.daysOffset;
    }

    if (body.channel !== undefined) {
      if (!isReminderChannel(body.channel)) {
        return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
      }
      data.channel = body.channel;
    }

    if (body.templateKey !== undefined) {
      if (body.templateKey !== null && typeof body.templateKey !== "string") {
        return NextResponse.json({ error: "templateKey must be string or null" }, { status: 400 });
      }
      data.templateKey = body.templateKey;
    }

    if (body.triggerType !== undefined) {
      if (!isReminderTriggerType(body.triggerType)) {
        return NextResponse.json({ error: "Invalid triggerType" }, { status: 400 });
      }
      data.triggerType = body.triggerType;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one updatable field is required" },
        { status: 400 },
      );
    }

    const updatedMany = await prisma.reminderRule.updateMany({
      where: {
        id: body.id,
        organizationId: orgId,
      },
      data,
    });

    if (updatedMany.count === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updated = await prisma.reminderRule.findFirst({
      where: { id: body.id, organizationId: orgId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ReminderRules] Patch error:", error);
    return NextResponse.json({ error: "Failed to update reminder rule" }, { status: 500 });
  }
}
