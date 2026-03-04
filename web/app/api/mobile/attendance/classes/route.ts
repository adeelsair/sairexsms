import { NextResponse } from "next/server";

import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type ClassQuickPickRow = {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  campusId: number;
  academicYearId: string;
  studentCount: number;
  isLastUsed: boolean;
};

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    return guard;
  }

  const roleCheck = requireRole(
    guard,
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "CAMPUS_ADMIN",
    "TEACHER",
  );
  if (roleCheck) {
    return roleCheck;
  }

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = guard.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    const baseWhere = {
      organizationId,
      status: "ACTIVE" as const,
      ...(guard.campusId ? { campusId: guard.campusId } : {}),
      ...(guard.unitPath
        ? { campus: { fullUnitPath: { startsWith: guard.unitPath } } }
        : {}),
    };

    const teacherOnly = guard.role === "TEACHER" && !isSuperAdmin(guard);
    const teacherFilter = teacherOnly
      ? { classTeacherId: guard.membershipId ?? -1 }
      : {};

    const sections = await prisma.section.findMany({
      where: {
        ...baseWhere,
        ...teacherFilter,
      },
      orderBy: [
        { class: { displayOrder: "asc" } },
        { class: { name: "asc" } },
        { name: "asc" },
      ],
      select: {
        id: true,
        classId: true,
        name: true,
        campusId: true,
        academicYearId: true,
        class: {
          select: {
            name: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
      },
      take: 100,
    });

    const lastMarked = guard.membershipId
      ? await prisma.attendance.findFirst({
          where: {
            organizationId,
            markedById: guard.membershipId,
            ...(guard.campusId ? { campusId: guard.campusId } : {}),
          },
          orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
          select: {
            classId: true,
            sectionId: true,
          },
        })
      : null;

    const rows: ClassQuickPickRow[] = sections.map((section) => ({
      classId: section.classId,
      sectionId: section.id,
      className: section.class.name,
      sectionName: section.name,
      campusId: section.campusId,
      academicYearId: section.academicYearId,
      studentCount: section.enrollments.length,
      isLastUsed:
        !!lastMarked &&
        lastMarked.classId === section.classId &&
        lastMarked.sectionId === section.id,
    }));

    rows.sort((a, b) => {
      if (a.isLastUsed !== b.isLastUsed) {
        return a.isLastUsed ? -1 : 1;
      }
      return `${a.className}-${a.sectionName}`.localeCompare(
        `${b.className}-${b.sectionName}`,
      );
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load attendance classes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
