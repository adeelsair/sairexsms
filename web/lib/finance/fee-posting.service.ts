import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { resolveBankAccountsBatch } from "./challan-routing.service";
import { emit } from "@/lib/events";

/* ── Types ──────────────────────────────────────────────── */

export interface PostingParams {
  organizationId: string;
  month: number;
  year: number;
  userId: number;
  campusId?: number;
  academicYearId?: string;
  dueDate?: Date;
}

export interface PostingResult {
  postingRunId: string;
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
  status: "COMPLETED" | "FAILED";
  errorMessage?: string;
}

export interface PostingRunRow {
  id: string;
  month: number;
  year: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  academicYearId: string | null;
  campusId: number | null;
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

const BATCH_SIZE = 500;

/* ── Challan Number Generator ───────────────────────────── */

function makeChallanNo(year: number, month: number, studentId: number, structureId: number): string {
  const mm = String(month).padStart(2, "0");
  return `FP-${year}${mm}-${studentId}-${structureId}`;
}

function defaultDueDate(year: number, month: number): Date {
  return new Date(year, month - 1, 10);
}

/* ── Main Posting Engine ────────────────────────────────── */

export async function runMonthlyPosting(params: PostingParams): Promise<PostingResult> {
  const {
    organizationId,
    month,
    year,
    userId,
    campusId,
    academicYearId,
    dueDate,
  } = params;

  const due = dueDate ?? defaultDueDate(year, month);

  let postingRun: { id: string } | null = null;

  try {
    postingRun = await prisma.postingRun.create({
      data: {
        organizationId,
        month,
        year,
        campusId: campusId ?? null,
        academicYearId: academicYearId ?? null,
        status: "PROCESSING",
        createdByUserId: userId,
      },
      select: { id: true },
    });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      throw new PostingError(`Fee posting for ${year}-${String(month).padStart(2, "0")} already exists`);
    }
    throw err;
  }

  const runId = postingRun.id;

  try {
    const result = await executePosting(runId, {
      organizationId,
      month,
      year,
      campusId,
      dueDate: due,
    });

    await prisma.postingRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalStudents: result.totalStudents,
        totalChallans: result.totalChallans,
        totalAmount: result.totalAmount,
      },
    });

    emit("FeePostingCompleted", organizationId, {
      postingRunId: runId,
      month,
      year,
      totalStudents: result.totalStudents,
      totalChallans: result.totalChallans,
      totalAmount: result.totalAmount,
    }, userId).catch(() => {});

    return {
      postingRunId: runId,
      ...result,
      status: "COMPLETED",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await prisma.postingRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });

    emit("FeePostingFailed", organizationId, {
      postingRunId: runId,
      month,
      year,
      errorMessage: message,
    }, userId).catch(() => {});

    return {
      postingRunId: runId,
      totalStudents: 0,
      totalChallans: 0,
      totalAmount: 0,
      status: "FAILED",
      errorMessage: message,
    };
  }
}

export async function listPostingRuns(
  organizationId: string,
  limit = 24,
): Promise<PostingRunRow[]> {
  const rows = await prisma.postingRun.findMany({
    where: { organizationId },
    orderBy: [{ year: "desc" }, { month: "desc" }, { startedAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      month: true,
      year: true,
      status: true,
      academicYearId: true,
      campusId: true,
      totalStudents: true,
      totalChallans: true,
      totalAmount: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    year: row.year,
    status: row.status,
    academicYearId: row.academicYearId,
    campusId: row.campusId,
    totalStudents: row.totalStudents,
    totalChallans: row.totalChallans,
    totalAmount: Number(row.totalAmount),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
  }));
}

/* ── Core Execution (chunked, transactional per batch) ──── */

interface ExecutionContext {
  organizationId: string;
  month: number;
  year: number;
  campusId?: number;
  dueDate: Date;
}

interface ExecutionResult {
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
}

async function executePosting(
  runId: string,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const { organizationId, month, year, campusId, dueDate } = ctx;

  const structureWhere: Prisma.FeeStructureWhereInput = {
    organizationId,
    frequency: "MONTHLY",
    isActive: true,
  };
  if (campusId) structureWhere.campusId = campusId;

  const structures = await prisma.feeStructure.findMany({
    where: structureWhere,
    select: { id: true, campusId: true, amount: true, applicableGrade: true, startMonth: true, endMonth: true },
  });

  const activeStructures = structures.filter((s) => {
    if (s.startMonth != null && month < s.startMonth) return false;
    if (s.endMonth != null && month > s.endMonth) return false;
    return true;
  });

  if (activeStructures.length === 0) {
    return { totalStudents: 0, totalChallans: 0, totalAmount: 0 };
  }

  const campusIds = [...new Set(activeStructures.map((s) => s.campusId))];

  const students = await prisma.student.findMany({
    where: {
      organizationId,
      campusId: { in: campusIds },
    },
    select: { id: true, campusId: true, grade: true },
  });

  if (students.length === 0) {
    return { totalStudents: 0, totalChallans: 0, totalAmount: 0 };
  }

  const bankRouting = await resolveBankAccountsBatch({ organizationId, campusIds });

  const studentsByCampus = new Map<number, typeof students>();
  for (const s of students) {
    const list = studentsByCampus.get(s.campusId) ?? [];
    list.push(s);
    studentsByCampus.set(s.campusId, list);
  }

  interface ChallanSeed {
    studentId: number;
    campusId: number;
    structureId: number;
    amount: number;
    bankAccountId: string | null;
  }

  const seeds: ChallanSeed[] = [];

  for (const structure of activeStructures) {
    const campusStudents = studentsByCampus.get(structure.campusId) ?? [];
    const structureAmt = Number(structure.amount);

    for (const student of campusStudents) {
      if (structure.applicableGrade && student.grade !== structure.applicableGrade) {
        continue;
      }

      seeds.push({
        studentId: student.id,
        campusId: student.campusId,
        structureId: structure.id,
        amount: structureAmt,
        bankAccountId: bankRouting.get(student.campusId)?.bankAccountId ?? null,
      });
    }
  }

  if (seeds.length === 0) {
    return { totalStudents: 0, totalChallans: 0, totalAmount: 0 };
  }

  let totalChallans = 0;
  let totalAmount = 0;
  const touchedStudents = new Set<number>();

  for (let i = 0; i < seeds.length; i += BATCH_SIZE) {
    const batch = seeds.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      const ledgerBatch: Prisma.LedgerEntryCreateManyInput[] = [];
      const summaryUpdates: { studentId: number; campusId: number; amount: number }[] = [];

      for (const seed of batch) {
        const challanNo = makeChallanNo(year, month, seed.studentId, seed.structureId);

        const existing = await tx.feeChallan.findFirst({
          where: { studentId: seed.studentId, month, year, feeStructureId: seed.structureId },
          select: { id: true },
        });
        if (existing) continue;

        const challan = await tx.feeChallan.create({
          data: {
            organizationId: ctx.organizationId,
            campusId: seed.campusId,
            studentId: seed.studentId,
            challanNo,
            dueDate,
            totalAmount: seed.amount,
            generatedBy: `PostingRun:${runId}`,
            month,
            year,
            feeStructureId: seed.structureId,
            bankAccountId: seed.bankAccountId,
          },
          select: { id: true },
        });

        ledgerBatch.push({
          organizationId: ctx.organizationId,
          studentId: seed.studentId,
          campusId: seed.campusId,
          challanId: challan.id,
          entryType: "CHALLAN_CREATED",
          direction: "DEBIT",
          amount: seed.amount,
        });

        summaryUpdates.push({
          studentId: seed.studentId,
          campusId: seed.campusId,
          amount: seed.amount,
        });

        touchedStudents.add(seed.studentId);
        totalChallans++;
        totalAmount += seed.amount;
      }

      if (ledgerBatch.length > 0) {
        await tx.ledgerEntry.createMany({ data: ledgerBatch });
      }

      for (const su of summaryUpdates) {
        await tx.studentFinancialSummary.upsert({
          where: { studentId: su.studentId },
          create: {
            studentId: su.studentId,
            organizationId: ctx.organizationId,
            campusId: su.campusId,
            totalDebit: su.amount,
            totalCredit: 0,
            balance: su.amount,
          },
          update: {
            totalDebit: { increment: su.amount },
            balance: { increment: su.amount },
          },
        });
      }
    });
  }

  return {
    totalStudents: touchedStudents.size,
    totalChallans,
    totalAmount,
  };
}

/* ── Helpers ────────────────────────────────────────────── */

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/* ── Custom Error ───────────────────────────────────────── */

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingError";
  }
}
