/**
 * Promotion handler — reacts to academic year lifecycle events.
 *
 * When an academic year is closed, this handler can trigger
 * downstream checks or notifications to administrators.
 */
import { onAsync } from "../bus";
import type {
  DomainEvent,
  AcademicYearClosedPayload,
  ExamPublishedPayload,
} from "../types";

async function onAcademicYearClosed(
  event: DomainEvent<AcademicYearClosedPayload>,
): Promise<void> {
  console.log(
    `[Promotion] AcademicYearClosed: ${event.payload.name} — ` +
    `promotion readiness should be checked for org ${event.organizationId}`,
  );
}

async function onExamPublished(
  event: DomainEvent<ExamPublishedPayload>,
): Promise<void> {
  console.log(
    `[Promotion] ExamPublished: ${event.payload.name} (${event.payload.examType}) ` +
    `for class ${event.payload.classId}`,
  );
}

/* ── Register ──────────────────────────────────────────── */

export function registerPromotionHandlers(): void {
  onAsync("AcademicYearClosed", "promotion:AcademicYearClosed", onAcademicYearClosed);
  onAsync("ExamPublished", "promotion:ExamPublished", onExamPublished);
}
