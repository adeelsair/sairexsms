import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getWizardProgress,
  completeWizardStep,
  skipWizardStep,
  resetWizard,
  WIZARD_STEPS,
} from "@/lib/adoption/onboarding.service";
import {
  bootstrapOrganizationSetup,
  CLASS_PRESETS,
  PRESET_LABELS,
} from "@/lib/adoption/bootstrap.service";
import { emit } from "@/lib/events";

/**
 * GET /api/adoption/wizard
 *
 * Returns current wizard progress for the authenticated organization.
 * Also includes available class presets for the setup form.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");

    if (view === "presets") {
      return NextResponse.json({
        classPresets: Object.entries(PRESET_LABELS).map(([key, label]) => ({
          key,
          label,
          classCount: CLASS_PRESETS[key].length,
          classes: CLASS_PRESETS[key].map((c) => c.name),
        })),
        steps: WIZARD_STEPS,
      });
    }

    const progress = await getWizardProgress(orgId);
    return NextResponse.json(progress);
  } catch (err) {
    console.error("[Wizard] Progress fetch error:", err);
    return NextResponse.json({ error: "Failed to load wizard progress" }, { status: 500 });
  }
}

/**
 * POST /api/adoption/wizard
 *
 * Actions:
 *   { action: "complete", stepKey: "..." }     — mark step done
 *   { action: "skip", stepKey: "..." }         — skip step
 *   { action: "reset" }                        — reset wizard
 *   { action: "bootstrap", ...bootstrapData }  — full transactional setup
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, stepKey } = body;

    if (action === "reset") {
      await resetWizard(orgId);
      return NextResponse.json({ success: true });
    }

    if (action === "bootstrap") {
      return handleBootstrap(orgId, body, guard.id);
    }

    if (!stepKey) {
      return NextResponse.json({ error: "stepKey is required" }, { status: 400 });
    }

    if (action === "complete") {
      const stepMetadata = body.metadata;
      const progress = await completeWizardStep(orgId, stepKey, stepMetadata);

      emit("WizardStepCompleted", orgId, {
        stepKey,
        stepNumber: progress.currentStep - 1,
        completed: progress.completed,
      }, guard.id).catch(() => {});

      return NextResponse.json(progress);
    }

    if (action === "skip") {
      const progress = await skipWizardStep(orgId, stepKey);
      return NextResponse.json(progress);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[Wizard] Action error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update wizard";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── Bootstrap Handler ────────────────────────────────── */

interface BootstrapBody {
  academicYear?: {
    name?: string;
    startDate?: string;
    endDate?: string;
  };
  classPreset?: string;
  customClasses?: Array<{ name: string; code: string; displayOrder: number }>;
  defaultSectionCapacity?: number;
  feePreset?: {
    monthlyTuition?: number;
    admissionFee?: number;
    examFee?: number;
  };
  campusIds?: number[];
}

async function handleBootstrap(
  orgId: string,
  body: BootstrapBody,
  userId: number,
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;
  const defaultName = `${currentYear}-${nextYear}`;

  const academicYear = {
    name: body.academicYear?.name ?? defaultName,
    startDate: body.academicYear?.startDate
      ? new Date(body.academicYear.startDate)
      : new Date(Date.UTC(currentYear, 3, 1)),
    endDate: body.academicYear?.endDate
      ? new Date(body.academicYear.endDate)
      : new Date(Date.UTC(nextYear, 2, 31)),
  };

  const result = await bootstrapOrganizationSetup({
    organizationId: orgId,
    academicYear,
    classPreset: body.classPreset,
    customClasses: body.customClasses,
    defaultSectionCapacity: body.defaultSectionCapacity,
    feePreset: body.feePreset
      ? {
          monthlyTuition: body.feePreset.monthlyTuition ?? 0,
          admissionFee: body.feePreset.admissionFee,
          examFee: body.feePreset.examFee,
        }
      : undefined,
    campusIds: body.campusIds,
  });

  emit("OrganizationBootstrapped", orgId, {
    academicYearId: result.academicYearId,
    academicYearName: result.academicYearName,
    campusIds: result.campusIds,
    classCount: result.classCount,
    sectionCount: result.sectionCount,
    feeStructureCount: result.feeStructureCount,
  }, userId).catch(() => {});

  return NextResponse.json({
    success: true,
    ...result,
  }, { status: 201 });
}
