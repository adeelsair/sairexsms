/**
 * Adoption handler — handles events from the phone-first auth,
 * QR infrastructure, and onboarding wizard layers.
 *
 * All handlers are ASYNC to keep the adoption flow fast.
 */
import { onAsync } from "../bus";
import type {
  DomainEvent,
  OtpRequestedPayload,
  PhoneLoginCompletedPayload,
  QrTokenGeneratedPayload,
  QrTokenResolvedPayload,
  ParentAccessCreatedPayload,
  WizardStepCompletedPayload,
  OrganizationBootstrappedPayload,
} from "../types";

async function onOtpRequested(
  event: DomainEvent<OtpRequestedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] OTP requested for ${event.payload.phone} via ${event.payload.channel}`,
  );
}

async function onPhoneLoginCompleted(
  event: DomainEvent<PhoneLoginCompletedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] Phone login: user ${event.payload.userId}, ` +
    `new=${event.payload.isNewUser}, phone=${event.payload.phone}`,
  );
}

async function onQrTokenGenerated(
  event: DomainEvent<QrTokenGeneratedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] QR generated: ${event.payload.type} → ref ${event.payload.referenceId}`,
  );
}

async function onQrTokenResolved(
  event: DomainEvent<QrTokenResolvedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] QR resolved: ${event.payload.type} → ref ${event.payload.referenceId}`,
  );
}

async function onParentAccessCreated(
  event: DomainEvent<ParentAccessCreatedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] Parent access: user ${event.payload.userId} → ` +
    `student ${event.payload.studentId}, membership ${event.payload.membershipId}`,
  );
}

async function onWizardStepCompleted(
  event: DomainEvent<WizardStepCompletedPayload>,
): Promise<void> {
  console.log(
    `[Adoption] Wizard step ${event.payload.stepNumber} (${event.payload.stepKey}) ` +
    `completed for org ${event.organizationId}` +
    (event.payload.completed ? " — WIZARD COMPLETE" : ""),
  );
}

async function onOrganizationBootstrapped(
  event: DomainEvent<OrganizationBootstrappedPayload>,
): Promise<void> {
  const p = event.payload;
  console.log(
    `[Adoption] Org ${event.organizationId} bootstrapped: ` +
    `year=${p.academicYearName}, campuses=${p.campusIds.length}, ` +
    `classes=${p.classCount}, sections=${p.sectionCount}, fees=${p.feeStructureCount}`,
  );
}

/* ── Register ──────────────────────────────────────────── */

export function registerAdoptionHandlers(): void {
  onAsync("OtpRequested", "adoption:OtpRequested", onOtpRequested);
  onAsync("PhoneLoginCompleted", "adoption:PhoneLoginCompleted", onPhoneLoginCompleted);
  onAsync("QrTokenGenerated", "adoption:QrTokenGenerated", onQrTokenGenerated);
  onAsync("QrTokenResolved", "adoption:QrTokenResolved", onQrTokenResolved);
  onAsync("ParentAccessCreated", "adoption:ParentAccessCreated", onParentAccessCreated);
  onAsync("WizardStepCompleted", "adoption:WizardStepCompleted", onWizardStepCompleted);
  onAsync("OrganizationBootstrapped", "adoption:OrganizationBootstrapped", onOrganizationBootstrapped);
}
