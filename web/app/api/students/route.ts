import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { scopeFilter, resolveOrgId, validateCrossRefs } from "@/lib/tenant";
import { incrementDailyStudentCount } from "@/lib/performance/organization-daily-stats.service";

// 1. GET: Fetch all students (tenant-scoped)
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const where = scopeFilter(guard, { hasCampus: true });

    const students = await prisma.student.findMany({
      where,
      include: {
        campus: true,
        organization: true,
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

// 2. POST: Admit a new student (tenant-scoped)
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();

    const orgId = resolveOrgId(guard);
    const campusId = parseInt(body.campusId);

    // Cross-reference validation: ensure campus belongs to the same org
    const crossRefError = await validateCrossRefs(orgId, [
      { model: "campus", id: campusId, label: "Campus" },
    ]);
    if (crossRefError) return crossRefError;

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          fullName: body.fullName,
          admissionNo: body.admissionNo,
          grade: body.grade,
          organizationId: orgId,
          campusId,
          feeStatus: "Unpaid",
        },
      });
      await incrementDailyStudentCount(tx, { organizationId: orgId });
      return created;
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Failed to admit student:", error);
    return NextResponse.json(
      { error: "Failed to admit student" },
      { status: 500 }
    );
  }
}
