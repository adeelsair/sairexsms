import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { scopeFilter, resolveOrgId, validateCrossRefs } from "@/lib/tenant";

// 1. GET: Fetch pricing rules (tenant-scoped)
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const where = scopeFilter(guard, { hasCampus: true });

    const structures = await prisma.feeStructure.findMany({
      where,
      include: {
        organization: true,
        campus: true,
        feeHead: true,
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(structures);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// 2. POST: Create a pricing rule (tenant-scoped)
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();

    const orgId = resolveOrgId(guard);
    const campusId = parseInt(body.campusId);
    const feeHeadId = parseInt(body.feeHeadId);

    // Cross-reference validation: ensure campus & feeHead belong to the same org
    const crossRefError = await validateCrossRefs(orgId, [
      { model: "campus", id: campusId, label: "Campus" },
      { model: "feeHead", id: feeHeadId, label: "Fee Head" },
    ]);
    if (crossRefError) return crossRefError;

    const structure = await prisma.feeStructure.create({
      data: {
        name: body.name,
        amount: parseFloat(body.amount),
        frequency: body.frequency,
        applicableGrade: body.applicableGrade || null,
        organizationId: orgId,
        campusId,
        feeHeadId,
      },
    });

    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    console.error("Pricing Rule Error:", error);
    return NextResponse.json(
      { error: "Failed to create pricing rule" },
      { status: 500 }
    );
  }
}
