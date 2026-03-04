import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import type { ReminderChannel, ReminderTriggerType } from "@/lib/generated/prisma";
import { emit } from "@/lib/events";
import { enqueue, REMINDER_QUEUE } from "@/lib/queue";

/* ── Types ──────────────────────────────────────────────── */

export interface ReminderRunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ReminderScope {
  organizationId: string;
  unitPath?: string | null;
  campusId?: number;
  triggerTypes?: ReminderTriggerType[];
}

interface TargetChallan {
  id: number;
  studentId: number;
  campusId: number;
  challanNo: string;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  daysDelta: number;
  student: { fullName: string; admissionNo: string; grade: string };
  campus: { name: string };
}

function isReminderLogDuplicateError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createReminderLogSafely(
  data: Prisma.ReminderLogCreateInput,
): Promise<{ created: true; logId: string } | { created: false }> {
  try {
    const log = await prisma.reminderLog.create({
      data,
      select: { id: true },
    });
    return { created: true, logId: log.id };
  } catch (error) {
    if (isReminderLogDuplicateError(error)) {
      return { created: false };
    }
    throw error;
  }
}

/* ── Template Renderer ──────────────────────────────────── */

export function renderTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return result;
}

/* ── Template Resolution ──────────────────────────────── */

async function resolveTemplate(
  organizationId: string,
  channel: ReminderChannel,
  templateKey: string | null,
  fallbackTemplate: string,
): Promise<string> {
  if (!templateKey) return fallbackTemplate;

  const dbTemplate = await prisma.messageTemplate.findFirst({
    where: {
      organizationId,
      channel,
      templateKey,
      isActive: true,
    },
    select: { content: true },
  });

  return dbTemplate?.content ?? fallbackTemplate;
}

/* ── Payment Link Generation ──────────────────────────── */

async function generatePaymentLink(
  organizationId: string,
  challanId: number,
): Promise<string> {
  try {
    const { generateQrToken } = await import("@/lib/adoption/qr-token.service");
    const result = await generateQrToken({
      organizationId,
      type: "FEE_PAYMENT",
      referenceId: String(challanId),
      ttlMs: 7 * 24 * 60 * 60 * 1000,
    });
    return result.url;
  } catch {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.sairex.com";
    return `${baseUrl}/pay/${challanId}`;
  }
}

/* ── Main Engine ────────────────────────────────────────── */

export async function runReminderEngine(
  scope: ReminderScope,
): Promise<ReminderRunResult> {
  const { organizationId } = scope;
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const result: ReminderRunResult = { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] };

  const ruleWhere: Prisma.ReminderRuleWhereInput = {
    organizationId,
    isActive: true,
  };
  if (scope.triggerTypes?.length) {
    ruleWhere.triggerType = { in: scope.triggerTypes };
  }

  const rules = await prisma.reminderRule.findMany({
    where: ruleWhere,
    orderBy: [{ triggerType: "asc" }, { daysOffset: "asc" }],
  });

  if (rules.length === 0) return result;

  const afterDueRules = rules.filter((r) =>
    r.triggerType === "AFTER_DUE" || r.triggerType === "FINAL_NOTICE",
  );
  const beforeDueRules = rules.filter((r) => r.triggerType === "BEFORE_DUE");
  const partialRules = rules.filter((r) => r.triggerType === "PARTIAL_PAYMENT");

  const baseCampusFilter: Prisma.FeeChallanWhereInput = {};
  if (scope.campusId) {
    baseCampusFilter.campusId = scope.campusId;
  } else if (scope.unitPath) {
    baseCampusFilter.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  if (afterDueRules.length > 0 || partialRules.length > 0) {
    await processOverdueChallans(
      organizationId, today, [...afterDueRules, ...partialRules], baseCampusFilter, result,
    );
  }

  if (beforeDueRules.length > 0) {
    await processUpcomingChallans(
      organizationId, today, beforeDueRules, baseCampusFilter, result,
    );
  }

  if (result.sent > 0) {
    emit("ReminderRunCompleted", organizationId, {
      processed: result.processed,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
    }).catch(() => {});
  }

  return result;
}

/* ── Overdue Challan Processing ────────────────────────── */

async function processOverdueChallans(
  organizationId: string,
  today: Date,
  rules: Awaited<ReturnType<typeof prisma.reminderRule.findMany>>,
  campusFilter: Prisma.FeeChallanWhereInput,
  result: ReminderRunResult,
) {
  const challans = await fetchChallans(organizationId, {
    ...campusFilter,
    status: { in: ["UNPAID", "PARTIALLY_PAID"] },
    dueDate: { lt: today },
  }, today);

  const afterDueRules = rules.filter((r) =>
    r.triggerType === "AFTER_DUE" || r.triggerType === "FINAL_NOTICE",
  );
  const partialRules = rules.filter((r) => r.triggerType === "PARTIAL_PAYMENT");

  const logIndex = await buildLogIndex(organizationId, challans);
  const processed = new Set<string>();

  for (const challan of challans) {
    result.processed++;

    const isPartial = challan.paidAmount > 0;
    const applicableRules = isPartial && partialRules.length > 0
      ? partialRules
      : afterDueRules;

    const matched = findMatchingRule(applicableRules, challan);
    if (!matched) { result.skipped++; continue; }

    const sent = await trySendReminder(
      organizationId, challan, matched, logIndex, processed, result,
    );
    if (!sent) result.skipped++;
  }
}

/* ── Upcoming (Before-Due) Processing ─────────────────── */

async function processUpcomingChallans(
  organizationId: string,
  today: Date,
  rules: Awaited<ReturnType<typeof prisma.reminderRule.findMany>>,
  campusFilter: Prisma.FeeChallanWhereInput,
  result: ReminderRunResult,
) {
  const maxOffset = Math.max(...rules.map((r) => Math.abs(r.daysOffset)));
  const futureDate = new Date(today.getTime() + maxOffset * 24 * 60 * 60 * 1000);

  const challans = await fetchChallans(organizationId, {
    ...campusFilter,
    status: { in: ["UNPAID", "PARTIALLY_PAID"] },
    dueDate: { gte: today, lte: futureDate },
  }, today);

  const logIndex = await buildLogIndex(organizationId, challans);
  const processed = new Set<string>();

  for (const challan of challans) {
    result.processed++;

    const daysUntilDue = Math.floor(
      (challan.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const matched = rules.find((r) => Math.abs(r.daysOffset) === daysUntilDue);
    if (!matched) { result.skipped++; continue; }

    const sent = await trySendReminder(
      organizationId, challan, matched, logIndex, processed, result,
    );
    if (!sent) result.skipped++;
  }
}

/* ── Send Reminder (shared) ───────────────────────────── */

async function trySendReminder(
  organizationId: string,
  challan: TargetChallan,
  rule: Awaited<ReturnType<typeof prisma.reminderRule.findMany>>[0],
  logIndex: Map<string, Date>,
  processed: Set<string>,
  result: ReminderRunResult,
): Promise<boolean> {
  const dedupeKey = `${challan.studentId}:${rule.id}`;
  if (processed.has(dedupeKey)) return false;

  const lastSent = logIndex.get(dedupeKey);
  if (lastSent) {
    const daysSince = Math.floor(
      (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSince < rule.frequencyDays) return false;
  }

  const template = await resolveTemplate(
    organizationId, rule.channel, rule.templateKey, rule.template,
  );

  const paymentLink = await generatePaymentLink(organizationId, challan.id);

  const templateVars: Record<string, string | number> = {
    studentName: challan.student.fullName,
    admissionNo: challan.student.admissionNo,
    grade: challan.student.grade,
    campusName: challan.campus.name,
    challanNo: challan.challanNo,
    amount: challan.outstanding,
    totalAmount: challan.totalAmount,
    paidAmount: challan.paidAmount,
    daysOverdue: Math.abs(challan.daysDelta),
    dueDate: challan.dueDate.toISOString().split("T")[0],
    paymentLink,
  };

  const messageBody = renderTemplate(template, templateVars);
  const reminderLogData: Prisma.ReminderLogCreateInput = {
    organization: { connect: { id: organizationId } },
    student: { connect: { id: challan.studentId } },
    challan: { connect: { id: challan.id } },
    reminderRule: { connect: { id: rule.id } },
    channel: rule.channel,
    triggerType: rule.triggerType,
    status: "SENT",
    messageBody,
    paymentLink,
  };

  try {
    const logResult = await createReminderLogSafely(reminderLogData);
    if (!logResult.created) return false;

    try {
      await enqueueReminderJob(organizationId, {
        channel: rule.channel,
        studentId: challan.studentId,
        challanId: challan.id,
        messageBody,
      });
    } catch (enqueueError) {
      const enqueueErrorMessage = enqueueError instanceof Error
        ? enqueueError.message
        : "Failed to enqueue reminder delivery";
      await prisma.reminderLog.update({
        where: { id: logResult.logId },
        data: {
          status: "FAILED",
          errorDetail: enqueueErrorMessage,
        },
      }).catch(() => {});
      throw enqueueError;
    }

    processed.add(dedupeKey);
    result.sent++;
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";

    await createReminderLogSafely({
      organization: { connect: { id: organizationId } },
      student: { connect: { id: challan.studentId } },
      challan: { connect: { id: challan.id } },
      reminderRule: { connect: { id: rule.id } },
      channel: rule.channel,
      triggerType: rule.triggerType,
      status: "FAILED",
      messageBody,
      paymentLink,
      errorDetail: errMsg,
    }).catch(() => {});

    result.failed++;
    result.errors.push(`Student ${challan.studentId}: ${errMsg}`);
    return true;
  }
}

/* ── Helpers ───────────────────────────────────────────── */

async function fetchChallans(
  organizationId: string,
  where: Prisma.FeeChallanWhereInput,
  today: Date,
): Promise<TargetChallan[]> {
  const raw = await prisma.feeChallan.findMany({
    where: { organizationId, ...where },
    select: {
      id: true,
      studentId: true,
      campusId: true,
      challanNo: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      student: { select: { fullName: true, admissionNo: true, grade: true } },
      campus: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return raw
    .map((c) => {
      const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
      const daysDelta = Math.floor(
        (today.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        ...c,
        totalAmount: Number(c.totalAmount),
        paidAmount: Number(c.paidAmount),
        outstanding,
        daysDelta,
      };
    })
    .filter((c) => c.outstanding > 0);
}

async function buildLogIndex(
  organizationId: string,
  challans: TargetChallan[],
): Promise<Map<string, Date>> {
  const studentIds = [...new Set(challans.map((c) => c.studentId))];
  if (studentIds.length === 0) return new Map();

  const recentLogs = await prisma.reminderLog.findMany({
    where: {
      organizationId,
      studentId: { in: studentIds },
      status: "SENT",
    },
    select: { studentId: true, reminderRuleId: true, sentAt: true },
    orderBy: { sentAt: "desc" },
  });

  const index = new Map<string, Date>();
  for (const log of recentLogs) {
    const key = `${log.studentId}:${log.reminderRuleId}`;
    const existing = index.get(key);
    if (!existing || log.sentAt > existing) {
      index.set(key, log.sentAt);
    }
  }
  return index;
}

function findMatchingRule(
  rules: Awaited<ReturnType<typeof prisma.reminderRule.findMany>>,
  challan: TargetChallan,
) {
  return rules.find((r) =>
    challan.daysDelta >= r.minDaysOverdue &&
    (r.maxDaysOverdue == null || challan.daysDelta <= r.maxDaysOverdue),
  );
}

/* ── Event-Driven Partial Payment Trigger ─────────────── */

export async function triggerPartialPaymentReminder(
  organizationId: string,
  challanId: number,
): Promise<void> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      organizationId,
      triggerType: "PARTIAL_PAYMENT",
      isActive: true,
    },
  });

  if (rules.length === 0) return;

  const challan = await prisma.feeChallan.findUnique({
    where: { id: challanId },
    select: {
      id: true,
      studentId: true,
      campusId: true,
      challanNo: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      student: { select: { fullName: true, admissionNo: true, grade: true } },
      campus: { select: { name: true } },
    },
  });

  if (!challan || challan.status === "PAID") return;

  const outstanding = Number(challan.totalAmount) - Number(challan.paidAmount);
  if (outstanding <= 0) return;

  const rule = rules[0];
  const paymentLink = await generatePaymentLink(organizationId, challan.id);
  const template = await resolveTemplate(
    organizationId, rule.channel, rule.templateKey, rule.template,
  );

  const messageBody = renderTemplate(template, {
    studentName: challan.student.fullName,
    admissionNo: challan.student.admissionNo,
    grade: challan.student.grade,
    campusName: challan.campus.name,
    challanNo: challan.challanNo,
    amount: outstanding,
    totalAmount: Number(challan.totalAmount),
    paidAmount: Number(challan.paidAmount),
    dueDate: challan.dueDate.toISOString().split("T")[0],
    paymentLink,
    daysOverdue: 0,
  });

  const logResult = await createReminderLogSafely({
    organization: { connect: { id: organizationId } },
    student: { connect: { id: challan.studentId } },
    challan: { connect: { id: challan.id } },
    reminderRule: { connect: { id: rule.id } },
    channel: rule.channel,
    triggerType: "PARTIAL_PAYMENT",
    status: "SENT",
    messageBody,
    paymentLink,
  });

  if (!logResult.created) {
    return;
  }

  try {
    await enqueueReminderJob(organizationId, {
      channel: rule.channel,
      studentId: challan.studentId,
      challanId: challan.id,
      messageBody,
    });
  } catch (enqueueError) {
    const enqueueErrorMessage = enqueueError instanceof Error
      ? enqueueError.message
      : "Failed to enqueue reminder delivery";
    await prisma.reminderLog.update({
      where: { id: logResult.logId },
      data: {
        status: "FAILED",
        errorDetail: enqueueErrorMessage,
      },
    }).catch(() => {});
    throw enqueueError;
  }
}

/* ── Delivery Status Update ───────────────────────────── */

export async function updateDeliveryStatus(
  externalRef: string,
  status: "DELIVERED" | "READ" | "FAILED",
): Promise<void> {
  const log = await prisma.reminderLog.findFirst({
    where: { externalRef },
  });

  if (!log) return;

  const data: Prisma.ReminderLogUpdateInput = { status };
  if (status === "DELIVERED") data.deliveredAt = new Date();
  if (status === "READ") {
    data.readAt = new Date();
    if (!log.deliveredAt) data.deliveredAt = new Date();
  }

  await prisma.reminderLog.update({ where: { id: log.id }, data });
}

/* ── Job Queue Integration ──────────────────────────────── */

async function enqueueReminderJob(
  organizationId: string,
  payload: {
    channel: ReminderChannel;
    studentId: number;
    challanId: number;
    messageBody: string;
  },
) {
  await enqueue({
    type: "REMINDER_DELIVERY",
    queue: REMINDER_QUEUE,
    organizationId,
    priority: 5,
    maxAttempts: 5,
    payload: {
      organizationId,
      studentId: payload.studentId,
      challanId: payload.challanId,
      channel: payload.channel,
      messageBody: payload.messageBody,
    },
  });
}

/* ── Reminder Rule CRUD ───────────────────────────────── */

export async function getReminderRules(organizationId: string) {
  return prisma.reminderRule.findMany({
    where: { organizationId },
    orderBy: [{ triggerType: "asc" }, { daysOffset: "asc" }, { channel: "asc" }],
    include: { campus: { select: { id: true, name: true } } },
  });
}

export async function createReminderRule(data: {
  organizationId: string;
  campusId?: number;
  name: string;
  triggerType?: ReminderTriggerType;
  daysOffset?: number;
  minDaysOverdue: number;
  maxDaysOverdue?: number;
  channel: ReminderChannel;
  templateKey?: string;
  template: string;
  frequencyDays?: number;
}) {
  return prisma.reminderRule.create({
    data: {
      organizationId: data.organizationId,
      campusId: data.campusId ?? null,
      name: data.name,
      triggerType: data.triggerType ?? "AFTER_DUE",
      daysOffset: data.daysOffset ?? data.minDaysOverdue,
      minDaysOverdue: data.minDaysOverdue,
      maxDaysOverdue: data.maxDaysOverdue ?? null,
      channel: data.channel,
      templateKey: data.templateKey,
      template: data.template,
      frequencyDays: data.frequencyDays ?? 7,
    },
  });
}

export async function updateReminderRule(
  ruleId: string,
  data: Partial<{
    name: string;
    triggerType: ReminderTriggerType;
    daysOffset: number;
    minDaysOverdue: number;
    maxDaysOverdue: number | null;
    channel: ReminderChannel;
    templateKey: string | null;
    template: string;
    frequencyDays: number;
    isActive: boolean;
  }>,
) {
  return prisma.reminderRule.update({ where: { id: ruleId }, data });
}

export async function deleteReminderRule(ruleId: string) {
  return prisma.reminderRule.update({ where: { id: ruleId }, data: { isActive: false } });
}

/* ── Message Template CRUD ─────────────────────────────── */

export async function getMessageTemplates(
  organizationId: string,
  channel?: ReminderChannel,
) {
  return prisma.messageTemplate.findMany({
    where: {
      organizationId,
      ...(channel ? { channel } : {}),
    },
    orderBy: [{ channel: "asc" }, { templateKey: "asc" }],
  });
}

export async function upsertMessageTemplate(data: {
  organizationId: string;
  channel: ReminderChannel;
  templateKey: string;
  name: string;
  content: string;
  isDefault?: boolean;
}) {
  return prisma.messageTemplate.upsert({
    where: {
      organizationId_channel_templateKey: {
        organizationId: data.organizationId,
        channel: data.channel,
        templateKey: data.templateKey,
      },
    },
    create: {
      organizationId: data.organizationId,
      channel: data.channel,
      templateKey: data.templateKey,
      name: data.name,
      content: data.content,
      isDefault: data.isDefault ?? false,
    },
    update: {
      name: data.name,
      content: data.content,
    },
  });
}

/* ── Reminder Stats ─────────────────────────────────────── */

export async function getReminderStats(
  organizationId: string,
  daysBack: number = 30,
) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const logs = await prisma.reminderLog.groupBy({
    by: ["channel", "status"],
    where: { organizationId, sentAt: { gte: since } },
    _count: { id: true },
  });

  const stats: Record<string, { sent: number; delivered: number; read: number; failed: number }> = {};

  for (const row of logs) {
    const ch = row.channel;
    if (!stats[ch]) stats[ch] = { sent: 0, delivered: 0, read: 0, failed: 0 };
    if (row.status === "SENT") stats[ch].sent += row._count.id;
    if (row.status === "DELIVERED") stats[ch].delivered += row._count.id;
    if (row.status === "READ") stats[ch].read += row._count.id;
    if (row.status === "FAILED") stats[ch].failed += row._count.id;
  }

  return stats;
}
