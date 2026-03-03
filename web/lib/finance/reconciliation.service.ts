import { prisma } from "@/lib/prisma";
import type { AuditActorContext } from "@/lib/audit/resolve-audit-actor";
import { Prisma } from "@/lib/generated/prisma";
import type { PaymentChannel } from "@/lib/generated/prisma";
import { emit } from "@/lib/events";
import { logger } from "@/lib/logger";
import { emitActionUpdated } from "@/lib/events/action-events";
import { incrementDailyRevenue } from "@/lib/performance/organization-daily-stats.service";

/* ── Types ──────────────────────────────────────────────── */

export interface RecordPaymentInput {
  organizationId: string;
  bankAccountId?: string;
  amount: number;
  currency?: string;
  transactionRef?: string;
  paymentChannel: PaymentChannel;
  paidAt: Date;
  challanId?: number;
  idempotencyKey?: string;
  rawPayload?: Record<string, unknown>;
  auditActor?: AuditActorContext;
}

export interface ReconcileInput {
  paymentRecordId: string;
  challanId: number;
  organizationId: string;
  auditActor?: AuditActorContext;
}

export interface ReverseInput {
  paymentRecordId: string;
  organizationId: string;
  reason: string;
  auditActor?: AuditActorContext;
}

export interface ReconciliationResult {
  paymentRecordId: string;
  challanId: number;
  challanStatus: string;
  newPaidAmount: number;
  ledgerEntryId: string;
}

/* ── Summary Helper ─────────────────────────────────────── */

type TxClient = Prisma.TransactionClient;

type AtomicChallanApplyResult = {
  id: number;
  studentId: number;
  campusId: number;
  paidAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  status: string;
};

async function applyPaymentToChallanAtomically(
  tx: TxClient,
  input: {
    challanId: number;
    organizationId: string;
    amount: number;
  },
): Promise<AtomicChallanApplyResult> {
  const rows = await tx.$queryRaw<AtomicChallanApplyResult[]>(Prisma.sql`
    UPDATE "FeeChallan"
    SET
      "paidAmount" = "paidAmount" + ${input.amount},
      "status" = CASE
        WHEN ("paidAmount" + ${input.amount}) >= "totalAmount"
          THEN 'PAID'::"ChallanStatus"
        ELSE 'PARTIALLY_PAID'::"ChallanStatus"
      END,
      "paidAt" = CASE
        WHEN ("paidAmount" + ${input.amount}) >= "totalAmount"
          THEN NOW()
        ELSE "paidAt"
      END
    WHERE
      "id" = ${input.challanId}
      AND "organizationId" = ${input.organizationId}
      AND "status" <> 'CANCELLED'::"ChallanStatus"
      AND ("totalAmount" - "paidAmount") >= ${input.amount}
    RETURNING "id", "studentId", "campusId", "paidAmount", "totalAmount", "status"
  `);

  if (rows.length === 0) {
    throw new ReconciliationError("Challan is already fully paid or payment exceeds remaining balance");
  }

  return rows[0];
}

async function adjustSummary(
  tx: TxClient,
  studentId: number,
  organizationId: string,
  campusId: number,
  direction: "DEBIT" | "CREDIT",
  amount: number,
) {
  const debitInc = direction === "DEBIT" ? amount : 0;
  const creditInc = direction === "CREDIT" ? amount : 0;
  const balanceDelta = debitInc - creditInc;

  await tx.studentFinancialSummary.upsert({
    where: { studentId },
    create: {
      studentId,
      organizationId,
      campusId,
      totalDebit: debitInc,
      totalCredit: creditInc,
      balance: balanceDelta,
    },
    update: {
      totalDebit: { increment: debitInc },
      totalCredit: { increment: creditInc },
      balance: { increment: balanceDelta },
    },
  });
}

/* ── Record Payment ─────────────────────────────────────── */

export async function recordPayment(input: RecordPaymentInput) {
  const {
    organizationId,
    bankAccountId,
    amount,
    currency = "PKR",
    transactionRef,
    paymentChannel,
    paidAt,
    challanId,
    idempotencyKey,
    rawPayload,
  } = input;

  return prisma.paymentRecord.create({
    data: {
      organizationId,
      bankAccountId: bankAccountId ?? null,
      amount,
      currency,
      transactionRef: transactionRef ?? null,
      paymentChannel,
      paidAt,
      challanId: challanId ?? null,
      rawPayload: rawPayload
        ? (rawPayload as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

/* ── Reconcile Payment → Challan ────────────────────────── */

export async function reconcilePayment(
  input: ReconcileInput,
): Promise<ReconciliationResult> {
  const { paymentRecordId, challanId, organizationId, auditActor } = input;
  logger.info({ paymentRecordId, challanId, orgId: organizationId }, "Reconciliation started");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.findUniqueOrThrow({
      where: { id: paymentRecordId },
    });

    if (payment.organizationId !== organizationId) {
      throw new ReconciliationError("Payment does not belong to this organization");
    }

    if (payment.status !== "PENDING") {
      throw new ReconciliationError(
        `Payment cannot be reconciled — current status: ${payment.status}`,
      );
    }

    const paymentAmt = Number(payment.amount);
    const challan = await applyPaymentToChallanAtomically(tx, {
      challanId,
      organizationId,
      amount: paymentAmt,
    });
    const newPaidAmount = Number(challan.paidAmount);
    const newStatus = challan.status;

    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "RECONCILED",
        challanId: challan.id,
      },
    });

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        organizationId,
        studentId: challan.studentId,
        campusId: challan.campusId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        direction: "CREDIT",
        amount: paymentAmt,
        referenceId: payment.id,
        referenceType: "PaymentRecord",
      },
    });

    await adjustSummary(tx, challan.studentId, organizationId, challan.campusId, "CREDIT", paymentAmt);
    await incrementDailyRevenue(tx, {
      organizationId,
      amount: paymentAmt,
      date: payment.paidAt ?? new Date(),
    });

    const result: ReconciliationResult = {
      paymentRecordId: payment.id,
      challanId: challan.id,
      challanStatus: newStatus,
      newPaidAmount,
      ledgerEntryId: ledgerEntry.id,
    };

    logger.info({ paymentRecordId: payment.id, challanId: challan.id, studentId: challan.studentId, amount: paymentAmt, status: newStatus, orgId: organizationId }, "Reconciliation completed");

    emit("PaymentReconciled", organizationId, {
      paymentRecordId: payment.id,
      challanId: challan.id,
      studentId: challan.studentId,
      campusId: challan.campusId,
      amount: paymentAmt,
      challanStatus: newStatus,
      newPaidAmount,
      ledgerEntryId: ledgerEntry.id,
    }, auditActor).catch(() => {});
    emitActionUpdated({
      orgId: organizationId,
      type: "FEE_COLLECTION",
    });

    return result;
  });
}

/* ── Record + Reconcile (single-step OTC entry) ─────────── */

export async function recordAndReconcile(
  input: RecordPaymentInput & { challanId: number },
): Promise<ReconciliationResult> {
  const {
    organizationId,
    bankAccountId,
    amount,
    currency = "PKR",
    transactionRef,
    paymentChannel,
    paidAt,
    challanId,
    idempotencyKey,
    rawPayload,
    auditActor,
  } = input;

  const txResult = await prisma.$transaction(async (tx) => {
    const challan = await applyPaymentToChallanAtomically(tx, {
      challanId,
      organizationId,
      amount,
    });

    const payment = await tx.paymentRecord.create({
      data: {
        organizationId,
        bankAccountId: bankAccountId ?? null,
        amount,
        currency,
        transactionRef: transactionRef ?? null,
        paymentChannel,
        gateway: "MANUAL",
        gatewayRef: idempotencyKey ?? null,
        paidAt,
        challanId,
        status: "RECONCILED",
        rawPayload: rawPayload
          ? (rawPayload as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const newPaidAmount = Number(challan.paidAmount);
    const newStatus = challan.status;

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        organizationId,
        studentId: challan.studentId,
        campusId: challan.campusId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        direction: "CREDIT",
        amount,
        referenceId: payment.id,
        referenceType: "PaymentRecord",
      },
    });

    await adjustSummary(tx, challan.studentId, organizationId, challan.campusId, "CREDIT", amount);
    await incrementDailyRevenue(tx, {
      organizationId,
      amount,
      date: paidAt,
    });

    return {
      paymentRecordId: payment.id,
      challanId: challan.id,
      challanStatus: newStatus,
      newPaidAmount,
      ledgerEntryId: ledgerEntry.id,
      studentId: challan.studentId,
      campusId: challan.campusId,
      amount,
    };
  });

  const result: ReconciliationResult = {
    paymentRecordId: txResult.paymentRecordId,
    challanId: txResult.challanId,
    challanStatus: txResult.challanStatus,
    newPaidAmount: txResult.newPaidAmount,
    ledgerEntryId: txResult.ledgerEntryId,
  };

  emitActionUpdated({
    orgId: organizationId,
    type: "FEE_COLLECTION",
  });
  emit("PaymentReconciled", organizationId, {
    paymentRecordId: txResult.paymentRecordId,
    challanId: txResult.challanId,
    studentId: txResult.studentId,
    campusId: txResult.campusId,
    amount: txResult.amount,
    challanStatus: txResult.challanStatus,
    newPaidAmount: txResult.newPaidAmount,
    ledgerEntryId: txResult.ledgerEntryId,
  }, auditActor).catch(() => {});

  return result;
}

/* ── Reverse Payment (Refund) ───────────────────────────── */

export async function reversePayment(
  input: ReverseInput,
): Promise<{ ledgerEntryId: string }> {
  const { paymentRecordId, organizationId, reason, auditActor } = input;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.findUniqueOrThrow({
      where: { id: paymentRecordId },
    });

    if (payment.organizationId !== organizationId) {
      throw new ReconciliationError("Payment does not belong to this organization");
    }

    if (payment.status !== "RECONCILED") {
      throw new ReconciliationError(
        `Only reconciled payments can be reversed — current status: ${payment.status}`,
      );
    }

    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });

    let studentId: number | null = null;
    let campusId: number | null = null;

    if (payment.challanId) {
      const challan = await tx.feeChallan.findUniqueOrThrow({
        where: { id: payment.challanId },
      });

      studentId = challan.studentId;
      campusId = challan.campusId;

      const newPaidAmount = Math.max(Number(challan.paidAmount) - Number(payment.amount), 0);
      const newStatus = newPaidAmount > 0 ? ("PARTIALLY_PAID" as const) : ("UNPAID" as const);

      await tx.feeChallan.update({
        where: { id: challan.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          paidAt: null,
        },
      });
    }

    const refundAmt = Number(payment.amount);

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        organizationId,
        studentId,
        campusId,
        challanId: payment.challanId,
        entryType: "REFUND",
        direction: "DEBIT",
        amount: refundAmt,
        referenceId: payment.id,
        referenceType: "PaymentRecord",
        notes: reason,
      },
    });

    if (studentId && campusId) {
      await adjustSummary(tx, studentId, organizationId, campusId, "DEBIT", refundAmt);
    }
    const statsDate = new Date(
      Date.UTC(
        (payment.paidAt ?? new Date()).getUTCFullYear(),
        (payment.paidAt ?? new Date()).getUTCMonth(),
        (payment.paidAt ?? new Date()).getUTCDate(),
      ),
    );
    await tx.organizationDailyStats.upsert({
      where: {
        organizationId_date: {
          organizationId,
          date: statsDate,
        },
      },
      update: {
        totalRevenue: { decrement: refundAmt },
        outstandingAmount: { increment: refundAmt },
      },
      create: {
        organizationId,
        date: statsDate,
        totalRevenue: 0,
        outstandingAmount: refundAmt,
      },
    });

    emit("PaymentReversed", organizationId, {
      paymentRecordId: payment.id,
      challanId: payment.challanId ?? 0,
      studentId: studentId ?? 0,
      amount: refundAmt,
      reason,
    }, auditActor).catch(() => {});

    return { ledgerEntryId: ledgerEntry.id };
  });
}

/* ── Mark Payment Failed ────────────────────────────────── */

export async function markPaymentFailed(
  paymentRecordId: string,
  organizationId: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.findUniqueOrThrow({
      where: { id: paymentRecordId },
    });

    if (payment.organizationId !== organizationId) {
      throw new ReconciliationError("Payment does not belong to this organization");
    }

    if (payment.status !== "PENDING") {
      throw new ReconciliationError(
        `Only pending payments can be marked failed — current status: ${payment.status}`,
      );
    }

    return tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        rawPayload: reason ? { failureReason: reason } : undefined,
      },
    });
  });
}

/* ── Custom Error ───────────────────────────────────────── */

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconciliationError";
  }
}
