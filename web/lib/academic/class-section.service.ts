import { prisma } from "@/lib/prisma";
import { assertYearOpen } from "./academic-year.service";

/* ── Types ──────────────────────────────────────────────── */

export interface CreateClassInput {
  organizationId: string;
  academicYearId: string;
  campusId: number;
  name: string;
  code?: string;
  displayOrder?: number;
}

export interface UpdateClassInput {
  name?: string;
  code?: string;
  displayOrder?: number;
}

export interface CreateSectionInput {
  organizationId: string;
  academicYearId: string;
  campusId: number;
  classId: string;
  name: string;
  capacity?: number;
  classTeacherId?: number;
}

export interface UpdateSectionInput {
  name?: string;
  capacity?: number;
  classTeacherId?: number | null;
}

export interface ClassWithSections {
  id: string;
  name: string;
  code: string | null;
  displayOrder: number | null;
  status: string;
  campusId: number;
  academicYearId: string;
  sections: SectionSummary[];
  _count: { enrollments: number };
}

export interface SectionSummary {
  id: string;
  name: string;
  capacity: number | null;
  classTeacherId: number | null;
  status: string;
  _count: { enrollments: number };
}

export interface ScopeFilter {
  organizationId: string;
  campusId?: number;
  unitPath?: string | null;
}

/* ── Class CRUD ─────────────────────────────────────────── */

export async function listClasses(
  scope: ScopeFilter,
  academicYearId: string,
): Promise<ClassWithSections[]> {
  const where: Record<string, unknown> = {
    organizationId: scope.organizationId,
    academicYearId,
    status: "ACTIVE",
  };

  if (scope.campusId) {
    where.campusId = scope.campusId;
  } else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  const classes = await prisma.class.findMany({
    where,
    orderBy: [{ campusId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { enrollments: true } },
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    displayOrder: c.displayOrder,
    status: c.status,
    campusId: c.campusId,
    academicYearId: c.academicYearId,
    sections: c.sections.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      classTeacherId: s.classTeacherId,
      status: s.status,
      _count: s._count,
    })),
    _count: c._count,
  }));
}

export async function getClassById(classId: string, organizationId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      _count: { select: { enrollments: true } },
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });

  if (!cls || cls.organizationId !== organizationId) {
    throw new ClassSectionError("Class not found");
  }

  return cls;
}

export async function createClass(input: CreateClassInput) {
  await assertYearOpen(input.academicYearId);

  return prisma.class.create({
    data: {
      organizationId: input.organizationId,
      academicYearId: input.academicYearId,
      campusId: input.campusId,
      name: input.name,
      code: input.code,
      displayOrder: input.displayOrder,
    },
  });
}

export async function updateClass(
  classId: string,
  organizationId: string,
  data: UpdateClassInput,
) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls || cls.organizationId !== organizationId) {
    throw new ClassSectionError("Class not found");
  }

  await assertYearOpen(cls.academicYearId);

  return prisma.class.update({
    where: { id: classId },
    data: {
      name: data.name,
      code: data.code,
      displayOrder: data.displayOrder,
    },
  });
}

export async function archiveClass(classId: string, organizationId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls || cls.organizationId !== organizationId) {
    throw new ClassSectionError("Class not found");
  }

  return prisma.$transaction([
    prisma.section.updateMany({
      where: { classId, organizationId },
      data: { status: "ARCHIVED" },
    }),
    prisma.class.update({
      where: { id: classId },
      data: { status: "ARCHIVED" },
    }),
  ]);
}

/* ── Section CRUD ───────────────────────────────────────── */

export async function createSection(input: CreateSectionInput) {
  await assertYearOpen(input.academicYearId);

  const cls = await prisma.class.findUnique({ where: { id: input.classId } });
  if (!cls || cls.organizationId !== input.organizationId) {
    throw new ClassSectionError("Class not found");
  }
  if (cls.academicYearId !== input.academicYearId) {
    throw new ClassSectionError("Class does not belong to the specified academic year");
  }
  if (cls.campusId !== input.campusId) {
    throw new ClassSectionError("Class does not belong to the specified campus");
  }

  if (input.classTeacherId) {
    const membership = await prisma.membership.findUnique({
      where: { id: input.classTeacherId },
      select: { organizationId: true },
    });
    if (!membership || membership.organizationId !== input.organizationId) {
      throw new ClassSectionError("Teacher not found in this organization");
    }
  }

  return prisma.section.create({
    data: {
      organizationId: input.organizationId,
      academicYearId: input.academicYearId,
      campusId: input.campusId,
      classId: input.classId,
      name: input.name,
      capacity: input.capacity,
      classTeacherId: input.classTeacherId,
    },
  });
}

export async function updateSection(
  sectionId: string,
  organizationId: string,
  data: UpdateSectionInput,
) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || section.organizationId !== organizationId) {
    throw new ClassSectionError("Section not found");
  }

  await assertYearOpen(section.academicYearId);

  if (data.classTeacherId !== undefined && data.classTeacherId !== null) {
    const membership = await prisma.membership.findUnique({
      where: { id: data.classTeacherId },
      select: { organizationId: true },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new ClassSectionError("Teacher not found in this organization");
    }
  }

  return prisma.section.update({
    where: { id: sectionId },
    data: {
      name: data.name,
      capacity: data.capacity,
      classTeacherId: data.classTeacherId,
    },
  });
}

export async function archiveSection(sectionId: string, organizationId: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || section.organizationId !== organizationId) {
    throw new ClassSectionError("Section not found");
  }

  return prisma.section.update({
    where: { id: sectionId },
    data: { status: "ARCHIVED" },
  });
}

/* ── Capacity Check ─────────────────────────────────────── */

export async function checkSectionCapacity(
  sectionId: string,
): Promise<{ capacity: number | null; enrolled: number; available: boolean }> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      capacity: true,
      _count: {
        select: {
          enrollments: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });

  if (!section) {
    throw new ClassSectionError("Section not found");
  }

  const enrolled = section._count.enrollments;
  const hasCapacity = section.capacity === null || enrolled < section.capacity;

  return {
    capacity: section.capacity,
    enrolled,
    available: hasCapacity,
  };
}

/* ── Bulk Copy (Year Rollover Helper) ───────────────────── */

export async function copyClassStructure(
  sourceYearId: string,
  targetYearId: string,
  organizationId: string,
) {
  await assertYearOpen(targetYearId);

  const sourceClasses = await prisma.class.findMany({
    where: { academicYearId: sourceYearId, organizationId, status: "ACTIVE" },
    include: { sections: { where: { status: "ACTIVE" } } },
  });

  if (sourceClasses.length === 0) {
    throw new ClassSectionError("No active classes found in source academic year");
  }

  return prisma.$transaction(async (tx) => {
    let classCount = 0;
    let sectionCount = 0;

    for (const src of sourceClasses) {
      const newClass = await tx.class.create({
        data: {
          organizationId,
          academicYearId: targetYearId,
          campusId: src.campusId,
          name: src.name,
          code: src.code,
          displayOrder: src.displayOrder,
        },
      });
      classCount++;

      for (const sec of src.sections) {
        await tx.section.create({
          data: {
            organizationId,
            academicYearId: targetYearId,
            campusId: sec.campusId,
            classId: newClass.id,
            name: sec.name,
            capacity: sec.capacity,
          },
        });
        sectionCount++;
      }
    }

    return { classCount, sectionCount };
  });
}

/* ── Custom Error ───────────────────────────────────────── */

export class ClassSectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassSectionError";
  }
}
