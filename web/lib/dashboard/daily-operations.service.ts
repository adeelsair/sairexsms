import { prisma } from "@/lib/prisma";

export type DailyOperationsSnapshot = {
  role: string;
  alerts: {
    unpaidChallans: number;
    feeDefaultersToday: number;
    pendingAdmissions: number;
    unmarkedStudentAttendance: number;
    unmarkedStaffAttendance: number;
    failedMessages: number;
  };
  kpis: {
    feeCollectedToday: number;
    newAdmissionsToday: number;
    studentsPresentToday: number;
    messagesSentToday: number;
    expensesToday: number;
  };
  financeToday: {
    invoicesGenerated: number;
    paymentsReceived: number;
    outstandingAmount: number;
    autoRemindersSent: number;
  };
  tasks: Array<{
    type: string;
    label: string;
    count: number;
    href: string;
  }>;
};

export type Context = {
  organizationId: string;
  campusId?: string;
  role: string;
  userId: string;
};

export async function getDailyOperationsSnapshot(
  ctx: Context,
): Promise<DailyOperationsSnapshot> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Keep prisma reference intentional in scaffold phase.
  void prisma;

  const [alerts, kpis, financeToday, tasks] = await Promise.all([
    resolveAlerts(ctx, todayStart, todayEnd),
    resolveKpis(ctx, todayStart, todayEnd),
    resolveFinanceToday(ctx, todayStart, todayEnd),
    resolveTasks(ctx),
  ]);

  return {
    role: ctx.role,
    alerts,
    kpis,
    financeToday,
    tasks,
  };
}

async function resolveAlerts(
  ctx: Context,
  start: Date,
  end: Date,
): Promise<DailyOperationsSnapshot["alerts"]> {
  const scope = scopeFilter(ctx);
  const now = new Date();

  const [unpaidChallans, feeDefaultersToday, pendingAdmissions, failedMessages] =
    await Promise.all([
      prisma.feeChallan.count({
        where: {
          ...scope,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
          dueDate: { lt: now },
        },
      }),
      prisma.feeChallan.count({
        where: {
          ...scope,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
          dueDate: { gte: start, lte: end },
        },
      }),
      prisma.studentEnrollment.count({
        where: {
          ...scope,
          status: "ACTIVE",
          admissionDate: null,
        },
      }),
      prisma.reminderLog.count({
        where: {
          organizationId: ctx.organizationId,
          ...(scope.campusId != null
            ? {
                student: {
                  campusId: scope.campusId,
                },
              }
            : {}),
          status: "FAILED",
          sentAt: { gte: start, lte: end },
        },
      }),
    ]);

  const [activeStudents, markedStudentAttendance, activeStaff, markedStaffAttendance] =
    await Promise.all([
      prisma.studentEnrollment.findMany({
        where: {
          ...scope,
          status: "ACTIVE",
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.attendance.findMany({
        where: {
          ...scope,
          date: { gte: start, lte: end },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.membership.count({
        where: {
          organizationId: ctx.organizationId,
          ...(scope.campusId != null ? { campusId: scope.campusId } : {}),
          status: "ACTIVE",
          role: { in: ["TEACHER", "ACCOUNTANT", "STAFF"] },
        },
      }),
      prisma.job.count({
        where: {
          organizationId: ctx.organizationId,
          type: "STAFF_ATTENDANCE_MARKED",
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

  const unmarkedStudentAttendance = activeStudents.length - markedStudentAttendance.length;
  const unmarkedStaffAttendance = activeStaff - markedStaffAttendance;

  return {
    unpaidChallans,
    feeDefaultersToday,
    pendingAdmissions,
    unmarkedStudentAttendance: Math.max(unmarkedStudentAttendance, 0),
    unmarkedStaffAttendance: Math.max(unmarkedStaffAttendance, 0),
    failedMessages,
  };
}

async function resolveKpis(
  ctx: Context,
  start: Date,
  end: Date,
): Promise<DailyOperationsSnapshot["kpis"]> {
  const scope = scopeFilter(ctx);

  const [feeCollected, newAdmissions, studentsPresent, messagesSent, expenses] =
    await Promise.all([
      prisma.paymentRecord.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: ctx.organizationId,
          ...(scope.campusId != null
            ? {
                challan: {
                  campusId: scope.campusId,
                },
              }
            : {}),
          status: "RECONCILED",
          paidAt: { gte: start, lte: end },
        },
      }),
      prisma.studentEnrollment.count({
        where: {
          ...scope,
          status: "ACTIVE",
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.attendance.count({
        where: {
          ...scope,
          status: "PRESENT",
          date: { gte: start, lte: end },
        },
      }),
      prisma.reminderLog.count({
        where: {
          organizationId: ctx.organizationId,
          ...(scope.campusId != null
            ? {
                student: {
                  campusId: scope.campusId,
                },
              }
            : {}),
          status: "SENT",
          sentAt: { gte: start, lte: end },
        },
      }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: {
          ...scope,
          direction: "DEBIT",
          entryDate: { gte: start, lte: end },
        },
      }),
    ]);

  return {
    feeCollectedToday: Number(feeCollected._sum.amount ?? 0),
    newAdmissionsToday: newAdmissions,
    studentsPresentToday: studentsPresent,
    messagesSentToday: messagesSent,
    expensesToday: Number(expenses._sum.amount ?? 0),
  };
}

async function resolveFinanceToday(
  ctx: Context,
  start: Date,
  end: Date,
): Promise<DailyOperationsSnapshot["financeToday"]> {
  const scope = scopeFilter(ctx);

  const [
    invoicesGenerated,
    paymentsReceived,
    outstandingTotals,
    autoRemindersSent,
  ] = await Promise.all([
    prisma.feeChallan.count({
      where: {
        ...scope,
        issueDate: { gte: start, lte: end },
      },
    }),
    prisma.paymentRecord.count({
      where: {
        organizationId: ctx.organizationId,
        ...(scope.campusId != null
          ? {
              challan: {
                campusId: scope.campusId,
              },
            }
          : {}),
        status: "RECONCILED",
        paidAt: { gte: start, lte: end },
      },
    }),
    prisma.feeChallan.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: {
        ...scope,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
    }),
    prisma.reminderLog.count({
      where: {
        organizationId: ctx.organizationId,
        ...(scope.campusId != null
          ? {
              student: {
                campusId: scope.campusId,
              },
            }
          : {}),
        triggerType: { in: ["BEFORE_DUE", "AFTER_DUE", "PARTIAL_PAYMENT", "FINAL_NOTICE"] },
        sentAt: { gte: start, lte: end },
      },
    }),
  ]);

  const outstandingAmount =
    Number(outstandingTotals._sum.totalAmount ?? 0) -
    Number(outstandingTotals._sum.paidAmount ?? 0);

  return {
    invoicesGenerated,
    paymentsReceived,
    outstandingAmount: Math.max(outstandingAmount, 0),
    autoRemindersSent,
  };
}

async function resolveTasks(
  ctx: Context,
): Promise<DailyOperationsSnapshot["tasks"]> {
  const scope = scopeFilter(ctx);
  const tasks: DailyOperationsSnapshot["tasks"] = [];
  const role = ctx.role.toUpperCase();

  if (["SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN"].includes(role)) {
    const pendingAdmissions = await prisma.studentEnrollment.count({
      where: {
        ...scope,
        status: "ACTIVE",
        admissionDate: null,
      },
    });

    if (pendingAdmissions > 0) {
      tasks.push({
        type: "ADMISSION_APPROVAL",
        label: `Approve ${pendingAdmissions} admissions`,
        count: pendingAdmissions,
        href: "/admin/enrollments?status=pending",
      });
    }
  }

  if (["ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT"].includes(role)) {
    const unverifiedPayments = await prisma.paymentRecord.count({
      where: {
        organizationId: ctx.organizationId,
        ...(scope.campusId != null
          ? {
              challan: {
                campusId: scope.campusId,
              },
            }
          : {}),
        status: "PENDING",
      },
    });

    if (unverifiedPayments > 0) {
      tasks.push({
        type: "PAYMENT_VERIFICATION",
        label: `Verify ${unverifiedPayments} payments`,
        count: unverifiedPayments,
        href: "/admin/payments?status=pending",
      });
    }
  }

  if (["ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT"].includes(role)) {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const studentsWithoutChallan = await prisma.student.count({
      where: {
        ...scope,
        feeChallans: {
          none: {
            month: currentMonth,
            year: currentYear,
            status: { not: "CANCELLED" },
          },
        },
      },
    });

    if (studentsWithoutChallan > 0) {
      tasks.push({
        type: "CHALLAN_GENERATION",
        label: `Generate ${studentsWithoutChallan} challans`,
        count: studentsWithoutChallan,
        href: "/admin/finance?tab=challans",
      });
    }
  }

  if (["CAMPUS_ADMIN", "TEACHER"].includes(role)) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendanceMarked = await prisma.attendance.count({
      where: {
        ...scope,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    if (attendanceMarked === 0) {
      tasks.push({
        type: "MARK_ATTENDANCE",
        label: "Mark today’s attendance",
        count: 1,
        href: "/admin/attendance",
      });
    }
  }

  return tasks;
}

function scopeFilter(ctx: Context) {
  const campusId = ctx.campusId ? Number(ctx.campusId) : undefined;

  return {
    organizationId: ctx.organizationId,
    ...(campusId != null && !Number.isNaN(campusId) ? { campusId } : {}),
  };
}
