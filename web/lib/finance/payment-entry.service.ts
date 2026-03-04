import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { AuditActorContext } from "@/lib/audit/resolve-audit-actor";
import type { PaymentChannel } from "@/lib/generated/prisma";
import { recordAndReconcile } from "./reconciliation.service";

interface FinanceScope {
  organizationId: string;
  campusId?: number;
  unitPath?: string | null;
}

export interface StudentSearchRow {
  id: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  campusId: number;
  campusName: string;
}

export interface StudentFinancialSummaryRow {
  studentId: number;
  fullName: string;
  admissionNo: string;
  campusId: number;
  campusName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface OutstandingChallanRow {
  id: number;
  challanNo: string;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: "UNPAID" | "PARTIALLY_PAID";
}

export interface ManualPaymentInput {
  organizationId: string;
  challanId: number;
  amount: number;
  paymentDate: Date;
  paymentChannel: PaymentChannel;
  referenceNumber?: string;
  notes?: string;
  auditActor?: AuditActorContext;
}

export async function searchStudentsForPayments(
  scope: FinanceScope,
  search: string,
  limit = 20,
): Promise<StudentSearchRow[]> {
  const query = search.trim();
  if (query.length < 2) return [];

  const where: Record<string, unknown> = {
    organizationId: scope.organizationId,
    OR: [
      { fullName: { contains: query, mode: "insensitive" } },
      { admissionNo: { contains: query, mode: "insensitive" } },
    ],
  };

  if (scope.campusId) {
    where.campusId = scope.campusId;
  } else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  const rows = await prisma.student.findMany({
    where,
    orderBy: [{ fullName: "asc" }],
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      fullName: true,
      admissionNo: true,
      grade: true,
      campusId: true,
      campus: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    admissionNo: row.admissionNo,
    grade: row.grade,
    campusId: row.campusId,
    campusName: row.campus.name,
  }));
}

export async function getStudentFinancialSummary(
  scope: FinanceScope,
  studentId: number,
): Promise<StudentFinancialSummaryRow> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      organizationId: true,
      fullName: true,
      admissionNo: true,
      campusId: true,
      campus: { select: { name: true, fullUnitPath: true } },
    },
  });

  if (!student || student.organizationId !== scope.organizationId) {
    throw new PaymentEntryError("Student not found");
  }

  if (scope.campusId && student.campusId !== scope.campusId) {
    throw new PaymentEntryError("Student is outside your campus scope");
  }

  if (scope.unitPath && !student.campus.fullUnitPath.startsWith(scope.unitPath)) {
    throw new PaymentEntryError("Student is outside your unit scope");
  }

  const summary = await prisma.studentFinancialSummary.findUnique({
    where: { studentId },
    select: {
      totalDebit: true,
      totalCredit: true,
      balance: true,
    },
  });

  return {
    studentId: student.id,
    fullName: student.fullName,
    admissionNo: student.admissionNo,
    campusId: student.campusId,
    campusName: student.campus.name,
    totalDebit: Number(summary?.totalDebit ?? 0),
    totalCredit: Number(summary?.totalCredit ?? 0),
    balance: Number(summary?.balance ?? 0),
  };
}

export async function listOutstandingChallansByStudent(
  scope: FinanceScope,
  studentId: number,
): Promise<OutstandingChallanRow[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      organizationId: true,
      campusId: true,
      campus: { select: { fullUnitPath: true } },
    },
  });

  if (!student || student.organizationId !== scope.organizationId) {
    throw new PaymentEntryError("Student not found");
  }

  if (scope.campusId && student.campusId !== scope.campusId) {
    throw new PaymentEntryError("Student is outside your campus scope");
  }

  if (scope.unitPath && !student.campus.fullUnitPath.startsWith(scope.unitPath)) {
    throw new PaymentEntryError("Student is outside your unit scope");
  }

  const challans = await prisma.feeChallan.findMany({
    where: {
      organizationId: scope.organizationId,
      studentId,
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      challanNo: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
    },
    take: 100,
  });

  return challans.map((challan) => {
    const totalAmount = Number(challan.totalAmount);
    const paidAmount = Number(challan.paidAmount);
    return {
      id: challan.id,
      challanNo: challan.challanNo,
      dueDate: challan.dueDate,
      totalAmount,
      paidAmount,
      balance: Math.max(totalAmount - paidAmount, 0),
      status: challan.status as OutstandingChallanRow["status"],
    };
  });
}

export async function reconcilePayment(input: ManualPaymentInput) {
  const challan = await prisma.feeChallan.findUnique({
    where: { id: input.challanId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
    },
  });

  if (!challan || challan.organizationId !== input.organizationId) {
    throw new PaymentEntryError("Challan not found");
  }

  if (challan.status === "CANCELLED") {
    throw new PaymentEntryError("Cannot reconcile a cancelled challan");
  }

  const balance = Number(challan.totalAmount) - Number(challan.paidAmount);
  if (balance <= 0) {
    throw new PaymentEntryError("Challan is already fully paid");
  }

  if (input.amount <= 0) {
    throw new PaymentEntryError("Payment amount must be greater than zero");
  }

  if (input.amount > balance) {
    throw new PaymentEntryError("Payment amount cannot exceed challan balance");
  }

  const inputDate = input.paymentDate.toISOString().slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  if (inputDate < todayDate) {
    throw new PaymentEntryError("Backdated payment entries are not allowed");
  }

  const idempotencyKey = buildManualPaymentIdempotencyKey({
    organizationId: input.organizationId,
    challanId: input.challanId,
    amount: input.amount,
    paymentDate: input.paymentDate,
    paymentChannel: input.paymentChannel,
    referenceNumber: input.referenceNumber,
  });

  const duplicate = await prisma.paymentRecord.findFirst({
    where: {
      organizationId: input.organizationId,
      gateway: "MANUAL",
      gatewayRef: idempotencyKey,
      status: { in: ["PENDING", "RECONCILED"] },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PaymentEntryError("Duplicate payment submission detected");
  }

  return recordAndReconcile({
    organizationId: input.organizationId,
    challanId: input.challanId,
    amount: input.amount,
    paidAt: input.paymentDate,
    paymentChannel: input.paymentChannel,
    transactionRef: input.referenceNumber,
    idempotencyKey,
    rawPayload: input.notes ? { notes: input.notes } : undefined,
    auditActor: input.auditActor,
  });
}

function buildManualPaymentIdempotencyKey(input: {
  organizationId: string;
  challanId: number;
  amount: number;
  paymentDate: Date;
  paymentChannel: PaymentChannel;
  referenceNumber?: string;
}) {
  const dateToken = input.paymentDate.toISOString().slice(0, 10);
  const ref = input.referenceNumber?.trim().toUpperCase() ?? "";
  const payload = [
    input.organizationId,
    String(input.challanId),
    input.amount.toFixed(2),
    dateToken,
    input.paymentChannel,
    ref,
  ].join("|");

  return `manual:${createHash("sha256").update(payload).digest("hex").slice(0, 32)}`;
}

export class PaymentEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentEntryError";
  }
}

