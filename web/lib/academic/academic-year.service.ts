import { prisma } from "@/lib/prisma";
import type { AcademicYearStatus } from "@/lib/generated/prisma";

/* ── Types ──────────────────────────────────────────────── */

export interface CreateAcademicYearInput {
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface AcademicYearSummary {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: AcademicYearStatus;
  isActive: boolean;
  enrollmentCount: number;
  createdAt: Date;
}

/* ── Active Year Resolver ───────────────────────────────── */

export async function getActiveAcademicYear(organizationId: string) {
  return prisma.academicYear.findFirst({
    where: {
      organizationId,
      isActive: true,
      status: "ACTIVE",
    },
  });
}

export async function requireActiveAcademicYear(organizationId: string) {
  const year = await getActiveAcademicYear(organizationId);
  if (!year) {
    throw new AcademicYearError("No active academic year configured for this organization");
  }
  return year;
}

/* ── List ────────────────────────────────────────────────── */

export async function listAcademicYears(organizationId: string): Promise<AcademicYearSummary[]> {
  const years = await prisma.academicYear.findMany({
    where: { organizationId },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });

  return years.map((y) => ({
    id: y.id,
    name: y.name,
    startDate: y.startDate,
    endDate: y.endDate,
    status: y.status,
    isActive: y.isActive,
    enrollmentCount: y._count.enrollments,
    createdAt: y.createdAt,
  }));
}

/* ── Create ──────────────────────────────────────────────── */

export async function createAcademicYear(input: CreateAcademicYearInput) {
  const { organizationId, name, startDate, endDate } = input;

  if (endDate <= startDate) {
    throw new AcademicYearError("End date must be after start date");
  }

  const overlap = await prisma.academicYear.findFirst({
    where: {
      organizationId,
      status: { not: "ARCHIVED" },
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } },
      ],
    },
    select: { id: true, name: true },
  });

  if (overlap) {
    throw new AcademicYearError(`Date range overlaps with existing year: ${overlap.name}`);
  }

  return prisma.academicYear.create({
    data: {
      organizationId,
      name,
      startDate,
      endDate,
      status: "DRAFT",
      isActive: false,
    },
  });
}

/* ── Activate (single-active enforcement) ────────────────── */

export async function activateAcademicYear(yearId: string, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.findUniqueOrThrow({
      where: { id: yearId },
    });

    if (year.organizationId !== organizationId) {
      throw new AcademicYearError("Academic year does not belong to this organization");
    }

    if (year.status === "CLOSED" || year.status === "ARCHIVED") {
      throw new AcademicYearError(`Cannot activate a ${year.status.toLowerCase()} academic year`);
    }

    await tx.academicYear.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    return tx.academicYear.update({
      where: { id: yearId },
      data: { isActive: true, status: "ACTIVE" },
    });
  });
}

/* ── Close ───────────────────────────────────────────────── */

export async function closeAcademicYear(yearId: string, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.findUniqueOrThrow({
      where: { id: yearId },
    });

    if (year.organizationId !== organizationId) {
      throw new AcademicYearError("Academic year does not belong to this organization");
    }

    if (year.status !== "ACTIVE") {
      throw new AcademicYearError("Only ACTIVE academic years can be closed");
    }

    return tx.academicYear.update({
      where: { id: yearId },
      data: { status: "CLOSED", isActive: false },
    });
  });
}

/* ── Archive ─────────────────────────────────────────────── */

export async function archiveAcademicYear(yearId: string, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.findUniqueOrThrow({
      where: { id: yearId },
    });

    if (year.organizationId !== organizationId) {
      throw new AcademicYearError("Academic year does not belong to this organization");
    }

    if (year.status !== "CLOSED") {
      throw new AcademicYearError("Only CLOSED academic years can be archived");
    }

    return tx.academicYear.update({
      where: { id: yearId },
      data: { status: "ARCHIVED", isActive: false },
    });
  });
}

/* ── Update (DRAFT only) ─────────────────────────────────── */

export async function updateAcademicYear(
  yearId: string,
  organizationId: string,
  data: Partial<{ name: string; startDate: Date; endDate: Date }>,
) {
  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.findUniqueOrThrow({
      where: { id: yearId },
    });

    if (year.organizationId !== organizationId) {
      throw new AcademicYearError("Academic year does not belong to this organization");
    }

    if (year.status !== "DRAFT") {
      throw new AcademicYearError("Only DRAFT academic years can be edited");
    }

    const startDate = data.startDate ?? year.startDate;
    const endDate = data.endDate ?? year.endDate;

    if (endDate <= startDate) {
      throw new AcademicYearError("End date must be after start date");
    }

    return tx.academicYear.update({
      where: { id: yearId },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  });
}

/* ── Lifecycle Validation Guards ─────────────────────────── */

export async function assertYearOpen(academicYearId: string) {
  const year = await prisma.academicYear.findUniqueOrThrow({
    where: { id: academicYearId },
    select: { status: true, name: true },
  });

  if (year.status === "CLOSED" || year.status === "ARCHIVED") {
    throw new AcademicYearError(
      `Academic year "${year.name}" is ${year.status.toLowerCase()} — no modifications allowed`,
    );
  }
}

/* ── Custom Error ───────────────────────────────────────── */

export class AcademicYearError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicYearError";
  }
}
