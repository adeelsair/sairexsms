/**
 * Guided School Setup Wizard — Onboarding Progress Service
 *
 * Tracks the wizard state per organization. All actual data
 * creation (academic year, classes, fee structures) calls
 * existing domain services — this is pure orchestration.
 *
 * The wizard is a 5-step flow:
 *   1. School Info (basic identity)
 *   2. Academic Year (create active session)
 *   3. Class Structure (pick preset → auto-create classes + sections)
 *   4. Fee Presets (monthly tuition, admission/exam optional)
 *   5. Review & Complete (mark done, redirect to dashboard)
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ── Wizard Steps ──────────────────────────────────────── */

export const WIZARD_STEPS = [
  { step: 1, key: "school_info", label: "School Information" },
  { step: 2, key: "academic_year", label: "Academic Year" },
  { step: 3, key: "class_structure", label: "Classes & Sections" },
  { step: 4, key: "fee_presets", label: "Fee Configuration" },
  { step: 5, key: "review_complete", label: "Review & Go Live" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

/* ── Types ─────────────────────────────────────────────── */

export interface WizardProgress {
  organizationId: string;
  currentStep: number;
  stepsCompleted: string[];
  completed: boolean;
  totalSteps: number;
  steps: typeof WIZARD_STEPS;
  metadata: Record<string, unknown> | null;
}

/* ── Get Progress ──────────────────────────────────────── */

export async function getWizardProgress(organizationId: string): Promise<WizardProgress> {
  const record = await prisma.onboardingProgress.findUnique({
    where: { organizationId },
  });

  if (!record) {
    return {
      organizationId,
      currentStep: 1,
      stepsCompleted: [],
      completed: false,
      totalSteps: TOTAL_STEPS,
      steps: WIZARD_STEPS,
      metadata: null,
    };
  }

  return {
    organizationId,
    currentStep: record.currentStep,
    stepsCompleted: (record.stepsCompleted as string[]) ?? [],
    completed: record.completed,
    totalSteps: TOTAL_STEPS,
    steps: WIZARD_STEPS,
    metadata: (record.metadata as Record<string, unknown>) ?? null,
  };
}

/* ── Mark Step Complete ────────────────────────────────── */

export async function completeWizardStep(
  organizationId: string,
  stepKey: string,
  stepMetadata?: Record<string, unknown>,
): Promise<WizardProgress> {
  const stepDef = WIZARD_STEPS.find((s) => s.key === stepKey);
  if (!stepDef) {
    throw new Error(`Unknown wizard step: ${stepKey}`);
  }

  const existing = await prisma.onboardingProgress.findUnique({
    where: { organizationId },
  });

  const currentCompleted: string[] = (existing?.stepsCompleted as string[]) ?? [];

  if (!currentCompleted.includes(stepKey)) {
    currentCompleted.push(stepKey);
  }

  const allComplete = currentCompleted.length >= TOTAL_STEPS;
  const nextStep = Math.min(stepDef.step + 1, TOTAL_STEPS);

  const existingMetadata = (existing?.metadata as Record<string, unknown>) ?? {};
  const mergedMetadata = stepMetadata
    ? { ...existingMetadata, [stepKey]: stepMetadata }
    : existingMetadata;
  const metadataJson = mergedMetadata as Prisma.InputJsonValue;

  const record = await prisma.onboardingProgress.upsert({
    where: { organizationId },
    create: {
      organizationId,
      currentStep: nextStep,
      stepsCompleted: currentCompleted,
      completed: allComplete,
      metadata: metadataJson,
    },
    update: {
      currentStep: existing ? Math.max(existing.currentStep, nextStep) : nextStep,
      stepsCompleted: currentCompleted,
      completed: allComplete,
      metadata: metadataJson,
    },
  });

  return {
    organizationId,
    currentStep: record.currentStep,
    stepsCompleted: currentCompleted,
    completed: record.completed,
    totalSteps: TOTAL_STEPS,
    steps: WIZARD_STEPS,
    metadata: mergedMetadata,
  };
}

/* ── Skip Step ─────────────────────────────────────────── */

export async function skipWizardStep(
  organizationId: string,
  stepKey: string,
): Promise<WizardProgress> {
  return completeWizardStep(organizationId, stepKey, { skipped: true });
}

/* ── Reset Wizard ──────────────────────────────────────── */

export async function resetWizard(organizationId: string): Promise<void> {
  await prisma.onboardingProgress.deleteMany({
    where: { organizationId },
  });
}
