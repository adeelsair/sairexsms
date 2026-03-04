import type { ChallanStatus, Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

export type MobileActionType =
  | "FEE_COLLECTION"
  | "ABSENT_FOLLOWUP"
  | "STAFF_ATTENDANCE"
  | "ADMISSION_ENQUIRY"
  | "APPROVAL_PENDING"
  | "RESULT_PUBLISH"
  | "EXPENSE_APPROVAL";

export type MobileActionPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type PriorityScore = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MobileAction = {
  id: string;
  actionKey: string;
  type: MobileActionType;
  title: string;
  subtitle?: string;
  priority: MobileActionPriority;
  count?: number;
  amount?: number;
  deepLink: string;
  dueAt?: Date;
};

export type GroupedTodayActions = {
  urgent: MobileAction[];
  attention: MobileAction[];
  info: MobileAction[];
  completedToday: MobileAction[];
  meta: {
    completedToday: number;
    totalGeneratedToday: number;
  };
};

export type MobileActionsUser = {
  id: string;
  role: string;
  campusId?: string;
};

const ROLE_ACTION_MAP: Record<string, MobileActionType[]> = {
  PRINCIPAL: [
    "ABSENT_FOLLOWUP",
    "APPROVAL_PENDING",
    "RESULT_PUBLISH",
    "EXPENSE_APPROVAL",
  ],
  ACCOUNTANT: ["FEE_COLLECTION", "EXPENSE_APPROVAL"],
  ADMIN: ["ADMISSION_ENQUIRY", "ABSENT_FOLLOWUP"],
  TEACHER: ["ABSENT_FOLLOWUP", "RESULT_PUBLISH"],
  SUPER_ADMIN: [
    "FEE_COLLECTION",
    "ABSENT_FOLLOWUP",
    "APPROVAL_PENDING",
    "RESULT_PUBLISH",
    "EXPENSE_APPROVAL",
    "ADMISSION_ENQUIRY",
  ],
};

const OPEN_CHALLAN_STATUSES: ChallanStatus[] = ["UNPAID", "PARTIALLY_PAID"];

function normalizePriority(score: number): MobileActionPriority {
  if (score >= 4) return "URGENT";
  if (score >= 2) return "HIGH";
  if (score === 1) return "MEDIUM";
  return "LOW";
}

export function calculatePriority(input: {
  type: MobileAction["type"];
  count?: number;
  amount?: number;
  dueAt?: Date;
}): MobileActionPriority {
  let score: PriorityScore = 0;

  if (input.type === "FEE_COLLECTION") {
    if ((input.amount ?? 0) > 200000) score += 4;
    else if ((input.amount ?? 0) > 100000) score += 2;
    else score += 1;
  }

  if (input.type === "ABSENT_FOLLOWUP") {
    if ((input.count ?? 0) > 30) score += 4;
    else if ((input.count ?? 0) > 10) score += 2;
    else score += 1;
  }

  if (input.type === "STAFF_ATTENDANCE") {
    if ((input.count ?? 0) > 5) score += 1;
  }

  if (input.type === "ADMISSION_ENQUIRY") {
    if ((input.count ?? 0) > 20) score += 2;
    else if ((input.count ?? 0) > 0) score += 1;
  }

  if (input.type === "APPROVAL_PENDING" || input.type === "EXPENSE_APPROVAL") {
    if ((input.count ?? 0) > 10) score += 3;
    else if ((input.count ?? 0) > 3) score += 2;
    else if ((input.count ?? 0) > 0) score += 1;
  }

  if (input.type === "RESULT_PUBLISH") {
    score += 1;
  }

  if (input.dueAt) {
    const hoursLeft = Math.floor(
      (input.dueAt.getTime() - Date.now()) / (1000 * 60 * 60),
    );
    if (hoursLeft <= 6) score += 2;
    else if (hoursLeft <= 24) score += 1;
  }

  return normalizePriority(score);
}

export function escalatePriority(
  priority: MobileAction["priority"],
): MobileAction["priority"] {
  if (priority === "LOW") return "MEDIUM";
  if (priority === "MEDIUM") return "HIGH";
  if (priority === "HIGH") return "URGENT";
  return "URGENT";
}

export function applyEscalationForDays(
  priority: MobileAction["priority"],
  daysIgnored: number,
): MobileAction["priority"] {
  const steps = Math.min(Math.max(daysIgnored, 0), 3);
  let escalated = priority;
  for (let i = 0; i < steps; i += 1) {
    escalated = escalatePriority(escalated);
  }
  return escalated;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfTomorrowUtc(from: Date): Date {
  const tomorrow = new Date(from);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
}

function isSameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function daysBetweenUtc(from: Date, to: Date): number {
  const fromDay = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((toDay - fromDay) / DAY_MS));
}

async function applyDedupAndEscalation(
  organizationId: string,
  userId: string,
  actions: MobileAction[],
): Promise<MobileAction[]> {
  const now = new Date();
  const finalActions: MobileAction[] = [];

  for (const action of actions) {
    const existing = await prisma.mobileActionLog.findUnique({
      where: {
        organizationId_userId_actionKey: {
          organizationId,
          userId,
          actionKey: action.actionKey,
        },
      },
      select: {
        id: true,
        lastShownAt: true,
        lastActedAt: true,
        escalationLevel: true,
      },
    });

    if (!existing) {
      await prisma.mobileActionLog.create({
        data: {
          organizationId,
          userId,
          actionType: action.type,
          actionKey: action.actionKey,
          lastShownAt: now,
        },
      });
      finalActions.push(action);
      continue;
    }

    if (existing.lastActedAt && isSameUtcDay(existing.lastActedAt, now)) {
      continue;
    }

    const daysIgnored = daysBetweenUtc(existing.lastShownAt, now);
    const escalationSteps = Math.min(Math.max(daysIgnored, 0), 3);
    const escalatedPriority = applyEscalationForDays(
      action.priority,
      escalationSteps,
    );

    const escalationLevel = existing.escalationLevel + escalationSteps;
    await prisma.mobileActionLog.update({
      where: { id: existing.id },
      data: {
        lastShownAt: now,
        escalationLevel,
      },
    });

    finalActions.push({
      ...action,
      priority: escalatedPriority,
    });
  }

  return finalActions;
}

function groupActions(actions: MobileAction[]): GroupedTodayActions {
  const completedToday = actions.filter((action) => action.id.startsWith("completed_"));
  const generatedToday = actions.filter((action) => !action.id.startsWith("completed_"));

  return {
    urgent: actions.filter((action) => action.priority === "URGENT"),
    attention: actions.filter((action) => action.priority === "HIGH"),
    info: actions.filter(
      (action) =>
        (action.priority === "MEDIUM" || action.priority === "LOW") &&
        !action.id.startsWith("completed_"),
    ),
    completedToday,
    meta: {
      completedToday: completedToday.length,
      totalGeneratedToday: generatedToday.length,
    },
  };
}

async function getTodayFeeDefaulters(input: {
  organizationId: string;
  campusId?: number;
  dayStart: Date;
  dayEnd: Date;
}) {
  const where: Prisma.FeeChallanWhereInput = {
    organizationId: input.organizationId,
    status: { in: OPEN_CHALLAN_STATUSES },
    dueDate: { gte: input.dayStart, lt: input.dayEnd },
  };

  if (input.campusId) {
    where.campusId = input.campusId;
  }

  const rows = await prisma.feeChallan.findMany({
    where,
    select: {
      studentId: true,
      totalAmount: true,
      paidAmount: true,
    },
  });

  const studentIds = new Set<number>();
  let outstandingAmount = 0;

  for (const row of rows) {
    const outstanding = Number(row.totalAmount) - Number(row.paidAmount);
    if (outstanding <= 0) {
      continue;
    }
    studentIds.add(row.studentId);
    outstandingAmount += outstanding;
  }

  return {
    count: studentIds.size,
    amount: outstandingAmount,
  };
}

async function getTodayAbsentees(input: {
  organizationId: string;
  campusId?: number;
  dayStart: Date;
  dayEnd: Date;
}) {
  const rows = await prisma.attendance.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ABSENT",
      date: { gte: input.dayStart, lt: input.dayEnd },
      ...(input.campusId ? { campusId: input.campusId } : {}),
    },
    distinct: ["studentId"],
    select: {
      studentId: true,
    },
  });

  return rows.length;
}

async function getCompletedToday(input: {
  organizationId: string;
  userId: number;
  campusId?: number;
  dayStart: Date;
  dayEnd: Date;
}) {
  const [payments, attendanceSections] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        organizationId: input.organizationId,
        direction: "CREDIT",
        entryType: "PAYMENT_RECEIVED",
        entryDate: { gte: input.dayStart, lt: input.dayEnd },
        ...(input.campusId ? { campusId: input.campusId } : {}),
      },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.attendance.findMany({
      where: {
        organizationId: input.organizationId,
        markedById: input.userId,
        date: { gte: input.dayStart, lt: input.dayEnd },
        ...(input.campusId ? { campusId: input.campusId } : {}),
      },
      distinct: ["sectionId"],
      select: { sectionId: true },
    }),
  ]);

  return {
    collectionCount: payments._count.id,
    collectionAmount: Number(payments._sum.amount ?? 0),
    sectionsMarked: attendanceSections.length,
  };
}

function normalizeRole(rawRole: string): keyof typeof ROLE_ACTION_MAP | null {
  const role = rawRole.trim().toUpperCase();
  if (role in ROLE_ACTION_MAP) {
    return role as keyof typeof ROLE_ACTION_MAP;
  }

  // Align existing organization role names to the capability map.
  if (role === "ORG_ADMIN" || role === "CAMPUS_ADMIN") {
    return "ADMIN";
  }
  return null;
}

export function filterActionsByRole(
  actions: MobileAction[],
  rawRole: string,
): MobileAction[] {
  const normalizedRole = normalizeRole(rawRole);
  const allowedTypes = normalizedRole ? ROLE_ACTION_MAP[normalizedRole] : [];
  return actions.filter((action) => allowedTypes.includes(action.type));
}

async function buildAllPossibleActions(
  organizationId: string,
  userId: string,
  campusId?: string,
): Promise<MobileAction[]> {
  const parsedCampusId =
    campusId && Number.isFinite(Number(campusId)) ? Number(campusId) : undefined;
  const parsedUserId = Number(userId);
  const dayStart = startOfTodayUtc();
  const dayEnd = startOfTomorrowUtc(dayStart);
  const dayToken = formatDateKey(dayStart);

  const actions: MobileAction[] = [];

  const [feeDue, absentees, completed] = await Promise.all([
    getTodayFeeDefaulters({
      organizationId,
      campusId: parsedCampusId,
      dayStart,
      dayEnd,
    }),
    getTodayAbsentees({
      organizationId,
      campusId: parsedCampusId,
      dayStart,
      dayEnd,
    }),
    Number.isFinite(parsedUserId)
      ? getCompletedToday({
          organizationId,
          userId: parsedUserId,
          campusId: parsedCampusId,
          dayStart,
          dayEnd,
        })
      : Promise.resolve({
          collectionCount: 0,
          collectionAmount: 0,
          sectionsMarked: 0,
        }),
  ]);

  if (feeDue.count > 0) {
    actions.push({
      id: "fee_due",
      actionKey: `fee_due_${dayToken}`,
      type: "FEE_COLLECTION",
      title: "Fee collection due today",
      subtitle: `${feeDue.count} students`,
      priority: calculatePriority({
        type: "FEE_COLLECTION",
        amount: feeDue.amount,
        count: feeDue.count,
        dueAt: dayEnd,
      }),
      count: feeDue.count,
      amount: feeDue.amount,
      deepLink: "/finance/collect",
      dueAt: dayEnd,
    });
  }

  if (absentees > 0) {
    actions.push({
      id: "absent_followup",
      actionKey: `absent_${dayToken}`,
      type: "ABSENT_FOLLOWUP",
      title: "Student absentees",
      subtitle: `${absentees} need follow-up`,
      priority: calculatePriority({
        type: "ABSENT_FOLLOWUP",
        count: absentees,
        dueAt: dayEnd,
      }),
      count: absentees,
      deepLink: "/attendance/students",
      dueAt: dayEnd,
    });
  }

  if (completed.collectionCount > 0) {
    actions.push({
      id: "completed_collection",
      actionKey: `completed_collection_${dayToken}`,
      type: "FEE_COLLECTION",
      title: "Collections completed today",
      subtitle: `${completed.collectionCount} entries posted`,
      priority: calculatePriority({
        type: "FEE_COLLECTION",
        amount: completed.collectionAmount,
        count: completed.collectionCount,
      }),
      count: completed.collectionCount,
      amount: completed.collectionAmount,
      deepLink: "/fee/collect",
    });
  }

  if (completed.sectionsMarked > 0) {
    actions.push({
      id: "completed_attendance",
      actionKey: `completed_attendance_${dayToken}`,
      type: "STAFF_ATTENDANCE",
      title: "Attendance marked today",
      subtitle: `${completed.sectionsMarked} sections completed`,
      priority: calculatePriority({
        type: "STAFF_ATTENDANCE",
        count: completed.sectionsMarked,
      }),
      count: completed.sectionsMarked,
      deepLink: "/attendance/mark",
    });
  }

  return actions;
}

export async function getTodayActions(
  organizationId: string,
  user: MobileActionsUser,
): Promise<GroupedTodayActions> {
  const dayStart = startOfTodayUtc();
  const dayEnd = startOfTomorrowUtc(dayStart);
  const rawActions = await buildAllPossibleActions(
    organizationId,
    user.id,
    user.campusId,
  );

  const filteredActions = filterActionsByRole(rawActions, user.role);
  const behaviorAwareActions = await applyDedupAndEscalation(
    organizationId,
    user.id,
    filteredActions,
  );
  const grouped = groupActions(behaviorAwareActions);

  const completedTodayCount = await prisma.mobileActionLog.count({
    where: {
      organizationId,
      userId: user.id,
      lastActedAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });

  return {
    ...grouped,
    meta: {
      completedToday: completedTodayCount,
      totalGeneratedToday:
        grouped.urgent.length +
        grouped.attention.length +
        grouped.info.length +
        completedTodayCount,
    },
  };
}

export async function markMobileActionCompleted(input: {
  organizationId: string;
  userId: string;
  actionKey: string;
}) {
  const existing = await prisma.mobileActionLog.findUnique({
    where: {
      organizationId_userId_actionKey: {
        organizationId: input.organizationId,
        userId: input.userId,
        actionKey: input.actionKey,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    return {
      ok: false as const,
      error: "Action log not found",
    };
  }

  await prisma.mobileActionLog.update({
    where: {
      organizationId_userId_actionKey: {
        organizationId: input.organizationId,
        userId: input.userId,
        actionKey: input.actionKey,
      },
    },
    data: {
      lastActedAt: new Date(),
    },
  });

  return { ok: true as const };
}
