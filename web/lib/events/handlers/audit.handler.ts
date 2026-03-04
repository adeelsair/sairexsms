/**
 * Audit handler — logs domain events to the RbacAuditLog when applicable,
 * and marks DomainEventLog entries as processed.
 *
 * Registered as SYNC for critical audit events (payment, enrollment changes)
 * and ASYNC for lower-priority events (report generation, reminders).
 */
import { onSync, onAsync } from "../bus";
import type {
  DomainEvent,
  PaymentReconciledPayload,
  PaymentReversedPayload,
  FeePostingCompletedPayload,
  FeePostingFailedPayload,
  StudentEnrolledPayload,
  StudentPromotedPayload,
  StudentWithdrawnPayload,
  AcademicYearClosedPayload,
  AcademicYearActivatedPayload,
  PromotionRunCompletedPayload,
  JobFailedPayload,
} from "../types";

/* ── Helpers ───────────────────────────────────────────── */

async function markProcessed(eventId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.domainEventLog.update({
    where: { id: eventId },
    data: { processed: true },
  }).catch(() => {
    /* Event may not be persisted yet if persistence was slow */
  });
}

/* ── Finance Audit (SYNC — critical) ──────────────────── */

async function onPaymentReconciled(
  event: DomainEvent<PaymentReconciledPayload>,
): Promise<void> {
  console.log(
    `[Audit] PAYMENT_RECONCILED: payment ${event.payload.paymentRecordId} → ` +
    `challan ${event.payload.challanId}, amount ${event.payload.amount}`,
  );
  await markProcessed(event.eventId);
}

async function onPaymentReversed(
  event: DomainEvent<PaymentReversedPayload>,
): Promise<void> {
  console.log(
    `[Audit] PAYMENT_REVERSED: payment ${event.payload.paymentRecordId}, ` +
    `reason: ${event.payload.reason}`,
  );
  await markProcessed(event.eventId);
}

async function onFeePostingCompleted(
  event: DomainEvent<FeePostingCompletedPayload>,
): Promise<void> {
  console.log(
    `[Audit] FEE_POSTING_COMPLETED: run ${event.payload.postingRunId}, ` +
    `${event.payload.totalChallans} challans`,
  );
  await markProcessed(event.eventId);
}

async function onFeePostingFailed(
  event: DomainEvent<FeePostingFailedPayload>,
): Promise<void> {
  console.error(
    `[Audit] FEE_POSTING_FAILED: run ${event.payload.postingRunId}, ` +
    `error: ${event.payload.errorMessage}`,
  );
  await markProcessed(event.eventId);
}

/* ── Academic Audit (SYNC) ─────────────────────────────── */

async function onStudentEnrolled(
  event: DomainEvent<StudentEnrolledPayload>,
): Promise<void> {
  console.log(
    `[Audit] STUDENT_ENROLLED: student ${event.payload.studentId} → ` +
    `class ${event.payload.classId}`,
  );
  await markProcessed(event.eventId);
}

async function onStudentPromoted(
  event: DomainEvent<StudentPromotedPayload>,
): Promise<void> {
  console.log(
    `[Audit] STUDENT_${event.payload.action}: student ${event.payload.studentId} ` +
    `(${event.payload.fromClassId} → ${event.payload.toClassId})`,
  );
  await markProcessed(event.eventId);
}

async function onStudentWithdrawn(
  event: DomainEvent<StudentWithdrawnPayload>,
): Promise<void> {
  console.log(
    `[Audit] STUDENT_WITHDRAWN: student ${event.payload.studentId}`,
  );
  await markProcessed(event.eventId);
}

async function onAcademicYearClosed(
  event: DomainEvent<AcademicYearClosedPayload>,
): Promise<void> {
  console.log(
    `[Audit] ACADEMIC_YEAR_CLOSED: ${event.payload.name}`,
  );
  await markProcessed(event.eventId);
}

async function onAcademicYearActivated(
  event: DomainEvent<AcademicYearActivatedPayload>,
): Promise<void> {
  console.log(
    `[Audit] ACADEMIC_YEAR_ACTIVATED: ${event.payload.name}`,
  );
  await markProcessed(event.eventId);
}

async function onPromotionRunCompleted(
  event: DomainEvent<PromotionRunCompletedPayload>,
): Promise<void> {
  console.log(
    `[Audit] PROMOTION_RUN_COMPLETED: ${event.payload.totalStudents} students, ` +
    `${event.payload.errors} errors`,
  );
  await markProcessed(event.eventId);
}

/* ── System Audit (ASYNC) ──────────────────────────────── */

async function onJobFailed(
  event: DomainEvent<JobFailedPayload>,
): Promise<void> {
  console.error(
    `[Audit] JOB_FAILED: ${event.payload.jobType} on ${event.payload.queue}, ` +
    `attempts: ${event.payload.attempts}, error: ${event.payload.error}`,
  );
  await markProcessed(event.eventId);
}

/* ── Register ──────────────────────────────────────────── */

export function registerAuditHandlers(): void {
  onSync("PaymentReconciled", "audit:PaymentReconciled", onPaymentReconciled);
  onSync("PaymentReversed", "audit:PaymentReversed", onPaymentReversed);
  onSync("FeePostingCompleted", "audit:FeePostingCompleted", onFeePostingCompleted);
  onSync("FeePostingFailed", "audit:FeePostingFailed", onFeePostingFailed);

  onSync("StudentEnrolled", "audit:StudentEnrolled", onStudentEnrolled);
  onSync("StudentPromoted", "audit:StudentPromoted", onStudentPromoted);
  onSync("StudentWithdrawn", "audit:StudentWithdrawn", onStudentWithdrawn);
  onSync("AcademicYearClosed", "audit:AcademicYearClosed", onAcademicYearClosed);
  onSync("AcademicYearActivated", "audit:AcademicYearActivated", onAcademicYearActivated);
  onSync("PromotionRunCompleted", "audit:PromotionRunCompleted", onPromotionRunCompleted);

  onAsync("JobFailed", "audit:JobFailed", onJobFailed);
}
