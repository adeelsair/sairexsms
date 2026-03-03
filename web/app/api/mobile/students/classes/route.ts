import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type QuickAdmissionClass = {
  classId: string;
  className: string;
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

    const activeYear = await prisma.academicYear.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });

    if (!activeYear) {
      return NextResponse.json(
        { error: "No active academic year found" },
        { status: 400 },
      );
    }

    const classes = await prisma.class.findMany({
      where: {
        organizationId,
        academicYearId: activeYear.id,
        status: "ACTIVE",
        ...(guard.campusId ? { campusId: guard.campusId } : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        campusId: true,
        academicYearId: true,
        _count: {
          select: {
            enrollments: {
              where: {
                status: "ACTIVE",
              },
            },
          },
        },
      },
      take: 100,
    });

    const lastEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        organizationId,
        ...(guard.campusId ? { campusId: guard.campusId } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      select: { classId: true },
    });

    const rows: QuickAdmissionClass[] = classes.map((row) => ({
      classId: row.id,
      className: row.name,
      campusId: row.campusId,
      academicYearId: row.academicYearId,
      studentCount: row._count.enrollments,
      isLastUsed: lastEnrollment?.classId === row.id,
    }));

    rows.sort((a, b) => {
      if (a.isLastUsed !== b.isLastUsed) {
        return a.isLastUsed ? -1 : 1;
      }
      return a.className.localeCompare(b.className);
    });

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load classes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
