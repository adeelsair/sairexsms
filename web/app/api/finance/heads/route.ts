import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { scopeFilter, resolveOrgId } from "@/lib/tenant";

// 1. GET: Fetch fee categories (tenant-scoped)
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const where = scopeFilter(guard);

    const heads = await prisma.feeHead.findMany({
      where,
      include: { organization: true },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(heads);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fee heads" },
      { status: 500 }
    );
  }
}

// 2. POST: Create a fee category (tenant-scoped)
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();

    const orgId = resolveOrgId(guard);

    const head = await prisma.feeHead.create({
      data: {
        name: body.name,
        type: body.type,
        organizationId: orgId,
        isSystemDefault: false,
      },
    });

    return NextResponse.json(head, { status: 201 });
  } catch (error) {
    console.error("Fee Head Error:", error);
    return NextResponse.json(
      { error: "Failed to create fee category" },
      { status: 500 }
    );
  }
}
