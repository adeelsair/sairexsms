/**
 * Notification handler — dispatches SMS/WhatsApp/Email
 * notifications as a reaction to domain events.
 *
 * All handlers are registered as ASYNC (queued via BullMQ).
 */
import { onAsync } from "../bus";
import type { DomainEvent, PaymentReconciledPayload, ChallanCreatedPayload, FeePostingCompletedPayload, PromotionRunCompletedPayload } from "../types";
import { triggerPartialPaymentReminder } from "@/lib/finance/reminder-engine.service";

async function onPaymentReconciled(
  event: DomainEvent<PaymentReconciledPayload>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, NOTIFICATION_QUEUE } = await import("@/lib/queue");

  const student = await prisma.student.findUnique({
    where: { id: event.payload.studentId },
    select: { fullName: true },
  });

  if (!student) return;

  const challan = await prisma.feeChallan.findUnique({
    where: { id: event.payload.challanId },
    select: { challanNo: true, dueDate: true },
  });

  if (!challan) return;

  await enqueue({
    type: "NOTIFICATION",
    queue: NOTIFICATION_QUEUE,
    organizationId: event.organizationId,
    userId: event.initiatedByUserId,
    payload: {
      studentName: student.fullName,
      parentEmail: undefined,
      parentPhone: undefined,
      challanNo: challan.challanNo,
      totalAmount: String(event.payload.amount),
      dueDate: challan.dueDate?.toISOString() ?? "",
      type: "PAID",
    },
  });

  if (event.payload.challanStatus === "PARTIALLY_PAID") {
    await triggerPartialPaymentReminder(
      event.organizationId,
      event.payload.challanId,
    );
  }
}

async function onChallanCreated(
  event: DomainEvent<ChallanCreatedPayload>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { enqueue, NOTIFICATION_QUEUE } = await import("@/lib/queue");

  const student = await prisma.student.findUnique({
    where: { id: event.payload.studentId },
    select: { fullName: true },
  });

  if (!student) return;

  await enqueue({
    type: "NOTIFICATION",
    queue: NOTIFICATION_QUEUE,
    organizationId: event.organizationId,
    payload: {
      studentName: student.fullName,
      parentEmail: undefined,
      parentPhone: undefined,
      challanNo: event.payload.challanNo,
      totalAmount: String(event.payload.totalAmount),
      dueDate: event.payload.dueDate,
      type: "GENERATED",
    },
  });
}

async function onFeePostingCompleted(
  event: DomainEvent<FeePostingCompletedPayload>,
): Promise<void> {
  console.log(
    `[Notification] FeePostingCompleted for org ${event.organizationId}: ` +
    `${event.payload.totalChallans} challans, PKR ${event.payload.totalAmount}`,
  );
}

async function onPromotionRunCompleted(
  event: DomainEvent<PromotionRunCompletedPayload>,
): Promise<void> {
  console.log(
    `[Notification] PromotionRunCompleted for org ${event.organizationId}: ` +
    `${event.payload.promoted} promoted, ${event.payload.retained} retained, ${event.payload.graduated} graduated`,
  );
}

/* ── Register ──────────────────────────────────────────── */

export function registerNotificationHandlers(): void {
  onAsync("PaymentReconciled", "notification:PaymentReconciled", onPaymentReconciled);
  onAsync("ChallanCreated", "notification:ChallanCreated", onChallanCreated);
  onAsync("FeePostingCompleted", "notification:FeePostingCompleted", onFeePostingCompleted);
  onAsync("PromotionRunCompleted", "notification:PromotionRunCompleted", onPromotionRunCompleted);
}
