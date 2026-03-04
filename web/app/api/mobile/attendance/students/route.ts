import { NextResponse } from "next/server";

import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

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
    const sectionId = searchParams.get("sectionId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }
    if (!sectionId) {
      return NextResponse.json(
        { error: "sectionId is required" },
        { status: 400 },
      );
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        organizationId: true,
        campusId: true,
        classId: true,
        academicYearId: true,
        classTeacherId: true,
      },
    });

    if (!section || section.organizationId !== organizationId) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (guard.campusId && section.campusId !== guard.campusId) {
      return NextResponse.json(
        { error: "Section is outside your campus scope" },
        { status: 403 },
      );
    }

    const isTeacher = guard.role === "TEACHER" && !isSuperAdmin(guard);
    if (isTeacher && section.classTeacherId !== guard.membershipId) {
      return NextResponse.json(
        { error: "You are not assigned to this class section" },
        { status: 403 },
      );
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        organizationId,
        sectionId: section.id,
        status: "ACTIVE",
      },
      orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        student: {
          select: {
            fullName: true,
            admissionNo: true,
          },
        },
      },
    });

    return NextResponse.json({
      section: {
        sectionId: section.id,
        classId: section.classId,
        campusId: section.campusId,
        academicYearId: section.academicYearId,
      },
      students: enrollments.map((row) => ({
        enrollmentId: row.id,
        studentId: row.studentId,
        rollNumber: row.rollNumber,
        fullName: row.student.fullName,
        admissionNo: row.student.admissionNo,
      })),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load section students";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
