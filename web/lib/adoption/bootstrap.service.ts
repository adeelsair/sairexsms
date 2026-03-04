/**
 * School Setup Bootstrap — Transactional Orchestration Service
 *
 * Creates a complete, ready-to-use school structure in a single
 * atomic transaction. This is pure orchestration — it writes to
 * existing domain models (AcademicYear, Class, Section, FeeHead,
 * FeeStructure) without inventing new business logic.
 *
 * Idempotent: if an active academic year already exists for the
 * organization, the bootstrap is skipped.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

/* ── Class Presets ────────────────────────────────────── */

export interface ClassPresetDef {
  name: string;
  code: string;
  displayOrder: number;
}

export const CLASS_PRESETS: Record<string, ClassPresetDef[]> = {
  "nursery-10": [
    { name: "Nursery", code: "NUR", displayOrder: 1 },
    { name: "Prep", code: "PREP", displayOrder: 2 },
    ...Array.from({ length: 10 }, (_, i) => ({
      name: `Grade ${i + 1}`,
      code: `G${i + 1}`,
      displayOrder: i + 3,
    })),
  ],
  "1-5": Array.from({ length: 5 }, (_, i) => ({
    name: `Grade ${i + 1}`,
    code: `G${i + 1}`,
    displayOrder: i + 1,
  })),
  "6-10": Array.from({ length: 5 }, (_, i) => ({
    name: `Grade ${i + 6}`,
    code: `G${i + 6}`,
    displayOrder: i + 1,
  })),
  "1-12": Array.from({ length: 12 }, (_, i) => ({
    name: `Grade ${i + 1}`,
    code: `G${i + 1}`,
    displayOrder: i + 1,
  })),
};

export const PRESET_LABELS: Record<string, string> = {
  "nursery-10": "Nursery → Grade 10",
  "1-5": "Grade 1 → 5 (Primary)",
  "6-10": "Grade 6 → 10 (Middle/High)",
  "1-12": "Grade 1 → 12 (Complete)",
};

/* ── Fee Preset Types ─────────────────────────────────── */

export interface FeePresetInput {
  monthlyTuition: number;
  admissionFee?: number;
  examFee?: number;
}

/* ── Bootstrap Input ──────────────────────────────────── */

export interface BootstrapInput {
  organizationId: string;
  academicYear: {
    name: string;
    startDate: Date;
    endDate: Date;
  };
  classPreset?: string;
  customClasses?: ClassPresetDef[];
  defaultSectionCapacity?: number;
  feePreset?: FeePresetInput;
  campusIds?: number[];
}

/* ── Bootstrap Result ─────────────────────────────────── */

export interface BootstrapResult {
  academicYearId: string;
  academicYearName: string;
  campusIds: number[];
  classCount: number;
  sectionCount: number;
  feeStructureCount: number;
}

/* ── Main Bootstrap Function ──────────────────────────── */

export async function bootstrapOrganizationSetup(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const { organizationId } = input;

  const existingYear = await prisma.academicYear.findFirst({
    where: { organizationId, isActive: true },
  });

  if (existingYear) {
    const classCount = await prisma.class.count({
      where: { organizationId, academicYearId: existingYear.id },
    });
    const sectionCount = await prisma.section.count({
      where: { organizationId, academicYearId: existingYear.id },
    });
    const feeCount = await prisma.feeStructure.count({
      where: { organizationId, isActive: true },
    });

    return {
      academicYearId: existingYear.id,
      academicYearName: existingYear.name,
      campusIds: input.campusIds ?? [],
      classCount,
      sectionCount,
      feeStructureCount: feeCount,
    };
  }

  const campuses = input.campusIds?.length
    ? await prisma.campus.findMany({
        where: { organizationId, id: { in: input.campusIds } },
        select: { id: true },
      })
    : await prisma.campus.findMany({
        where: { organizationId },
        select: { id: true },
        take: 50,
      });

  if (campuses.length === 0) {
    throw new Error("No campuses found. Please create at least one campus first.");
  }

  const campusIds = campuses.map((c) => c.id);
  const classDefs = resolveClassDefs(input);
  const capacity = input.defaultSectionCapacity ?? 40;

  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.create({
      data: {
        organizationId,
        name: input.academicYear.name,
        startDate: input.academicYear.startDate,
        endDate: input.academicYear.endDate,
        status: "ACTIVE",
        isActive: true,
      },
    });

    const classRecords: Prisma.ClassCreateManyInput[] = [];
    for (const campusId of campusIds) {
      for (const def of classDefs) {
        classRecords.push({
          organizationId,
          academicYearId: year.id,
          campusId,
          name: def.name,
          code: def.code,
          displayOrder: def.displayOrder,
          status: "ACTIVE",
        });
      }
    }

    await tx.class.createMany({ data: classRecords });

    const createdClasses = await tx.class.findMany({
      where: { organizationId, academicYearId: year.id },
      select: { id: true, campusId: true },
    });

    const sectionRecords: Prisma.SectionCreateManyInput[] = createdClasses.map((cls) => ({
      organizationId,
      academicYearId: year.id,
      campusId: cls.campusId,
      classId: cls.id,
      name: "A",
      capacity,
      status: "ACTIVE",
    }));

    await tx.section.createMany({ data: sectionRecords });

    let feeStructureCount = 0;

    if (input.feePreset) {
      feeStructureCount = await createFeePresets(
        tx,
        organizationId,
        campusIds,
        input.feePreset,
      );
    }

    await tx.onboardingProgress.upsert({
      where: { organizationId },
      create: {
        organizationId,
        currentStep: 5,
        stepsCompleted: [
          "school_info",
          "academic_year",
          "class_structure",
          "fee_presets",
          "review_complete",
        ],
        completed: true,
        metadata: {
          bootstrappedAt: new Date().toISOString(),
          classPreset: input.classPreset ?? "custom",
          campusCount: campusIds.length,
        },
      },
      update: {
        currentStep: 5,
        completed: true,
        stepsCompleted: [
          "school_info",
          "academic_year",
          "class_structure",
          "fee_presets",
          "review_complete",
        ],
      },
    });

    return {
      academicYearId: year.id,
      academicYearName: year.name,
      campusIds,
      classCount: classRecords.length,
      sectionCount: sectionRecords.length,
      feeStructureCount,
    };
  });
}

/* ── Helpers ───────────────────────────────────────────── */

function resolveClassDefs(input: BootstrapInput): ClassPresetDef[] {
  if (input.customClasses?.length) {
    return input.customClasses;
  }

  const preset = input.classPreset ?? "nursery-10";
  const defs = CLASS_PRESETS[preset];

  if (!defs) {
    throw new Error(
      `Unknown class preset: ${preset}. Available: ${Object.keys(CLASS_PRESETS).join(", ")}`,
    );
  }

  return defs;
}

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function createFeePresets(
  tx: TxClient,
  organizationId: string,
  campusIds: number[],
  preset: FeePresetInput,
): Promise<number> {
  let count = 0;

  const feeEntries: Array<{
    headName: string;
    headType: string;
    amount: number;
    frequency: "MONTHLY" | "ANNUAL";
  }> = [];

  if (preset.monthlyTuition > 0) {
    feeEntries.push({
      headName: "Monthly Tuition",
      headType: "TUITION",
      amount: preset.monthlyTuition,
      frequency: "MONTHLY",
    });
  }

  if (preset.admissionFee && preset.admissionFee > 0) {
    feeEntries.push({
      headName: "Admission Fee",
      headType: "ADMISSION",
      amount: preset.admissionFee,
      frequency: "ANNUAL",
    });
  }

  if (preset.examFee && preset.examFee > 0) {
    feeEntries.push({
      headName: "Exam Fee",
      headType: "EXAM",
      amount: preset.examFee,
      frequency: "ANNUAL",
    });
  }

  for (const entry of feeEntries) {
    let feeHead = await tx.feeHead.findFirst({
      where: { organizationId, name: entry.headName },
    });

    if (!feeHead) {
      feeHead = await tx.feeHead.create({
        data: {
          organizationId,
          name: entry.headName,
          type: entry.headType,
          isSystemDefault: true,
        },
      });
    }

    for (const campusId of campusIds) {
      await tx.feeStructure.create({
        data: {
          organizationId,
          campusId,
          feeHeadId: feeHead.id,
          name: entry.headName,
          amount: entry.amount,
          frequency: entry.frequency,
          isActive: true,
        },
      });
      count++;
    }
  }

  return count;
}
