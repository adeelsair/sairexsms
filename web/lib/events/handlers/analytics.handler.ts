/**
 * Analytics handler — updates materialized summaries and cached
 * metrics in response to domain events.
 *
 * Registered as ASYNC so analytics never blocks the primary flow.
 */
import { onAsync } from "../bus";
import type {
  DomainEvent,
  PaymentReconciledPayload,
  FeePostingCompletedPayload,
  StudentEnrolledPayload,
  StudentWithdrawnPayload,
  PromotionRunCompletedPayload,
} from "../types";

async function onPaymentReconciled(
  event: DomainEvent<PaymentReconciledPayload>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  await prisma.domainEventLog.updateMany({
    where: { id: event.eventId },
    data: { processed: true },
  });

  console.log(
    `[Analytics] PaymentReconciled: challan ${event.payload.challanId}, ` +
    `amount ${event.payload.amount}, new status ${event.payload.challanStatus}`,
  );
}

async function onFeePostingCompleted(
  event: DomainEvent<FeePostingCompletedPayload>,
): Promise<void> {
  console.log(
    `[Analytics] FeePostingCompleted: ${event.payload.totalChallans} challans totaling ` +
    `PKR ${event.payload.totalAmount} for ${event.payload.month}/${event.payload.year}`,
  );
}

async function onStudentEnrolled(
  event: DomainEvent<StudentEnrolledPayload>,
): Promise<void> {
  console.log(
    `[Analytics] StudentEnrolled: student ${event.payload.studentId} → ` +
    `class ${event.payload.classId}, campus ${event.payload.campusId}`,
  );
}

async function onStudentWithdrawn(
  event: DomainEvent<StudentWithdrawnPayload>,
): Promise<void> {
  console.log(
    `[Analytics] StudentWithdrawn: student ${event.payload.studentId}, ` +
    `campus ${event.payload.campusId}`,
  );
}

async function onPromotionRunCompleted(
  event: DomainEvent<PromotionRunCompletedPayload>,
): Promise<void> {
  console.log(
    `[Analytics] PromotionRunCompleted: ${event.payload.totalStudents} students processed ` +
    `(P:${event.payload.promoted} R:${event.payload.retained} G:${event.payload.graduated})`,
  );
}

/* ── Register ──────────────────────────────────────────── */

export function registerAnalyticsHandlers(): void {
  onAsync("PaymentReconciled", "analytics:PaymentReconciled", onPaymentReconciled);
  onAsync("FeePostingCompleted", "analytics:FeePostingCompleted", onFeePostingCompleted);
  onAsync("StudentEnrolled", "analytics:StudentEnrolled", onStudentEnrolled);
  onAsync("StudentWithdrawn", "analytics:StudentWithdrawn", onStudentWithdrawn);
  onAsync("PromotionRunCompleted", "analytics:PromotionRunCompleted", onPromotionRunCompleted);
}
