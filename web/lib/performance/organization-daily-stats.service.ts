import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

type Tx = Prisma.TransactionClient;

export function toDailyStatsDate(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function incrementDailyRevenue(
  tx: Tx,
  input: {
    organizationId: string;
    amount: number;
    date?: Date;
  },
) {
  const statsDate = toDailyStatsDate(input.date);
  await tx.organizationDailyStats.upsert({
    where: {
      organizationId_date: {
        organizationId: input.organizationId,
        date: statsDate,
      },
    },
    update: {
      totalRevenue: { increment: input.amount },
      outstandingAmount: { decrement: input.amount },
    },
    create: {
      organizationId: input.organizationId,
      date: statsDate,
      totalRevenue: input.amount,
      outstandingAmount: 0,
    },
  });
}

export async function incrementDailyStudentCount(
  tx: Tx,
  input: {
    organizationId: string;
    amount?: number;
    date?: Date;
  },
) {
  const statsDate = toDailyStatsDate(input.date);
  await tx.organizationDailyStats.upsert({
    where: {
      organizationId_date: {
        organizationId: input.organizationId,
        date: statsDate,
      },
    },
    update: {
      studentCount: { increment: input.amount ?? 1 },
    },
    create: {
      organizationId: input.organizationId,
      date: statsDate,
      studentCount: input.amount ?? 1,
    },
  });
}

export async function incrementDailyChallanCount(
  tx: Tx,
  input: {
    organizationId: string;
    challanCount?: number;
    outstandingAmount: number;
    date?: Date;
  },
) {
  const statsDate = toDailyStatsDate(input.date);
  await tx.organizationDailyStats.upsert({
    where: {
      organizationId_date: {
        organizationId: input.organizationId,
        date: statsDate,
      },
    },
    update: {
      challanCount: { increment: input.challanCount ?? 1 },
      outstandingAmount: { increment: input.outstandingAmount },
    },
    create: {
      organizationId: input.organizationId,
      date: statsDate,
      challanCount: input.challanCount ?? 1,
      outstandingAmount: input.outstandingAmount,
    },
  });
}

export async function syncDailyAttendanceCount(input: {
  organizationId: string;
  date?: Date;
}) {
  const statsDate = toDailyStatsDate(input.date);
  const attendanceCount = await prisma.attendance.count({
    where: {
      organizationId: input.organizationId,
      date: statsDate,
    },
  });

  await prisma.organizationDailyStats.upsert({
    where: {
      organizationId_date: {
        organizationId: input.organizationId,
        date: statsDate,
      },
    },
    update: {
      attendanceCount,
    },
    create: {
      organizationId: input.organizationId,
      date: statsDate,
      attendanceCount,
    },
  });
}
