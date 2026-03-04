import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getFeeTemplates,
  createFeeTemplate,
  updateFeeTemplate,
  deleteFeeTemplate,
} from "@/lib/governance";

/**
 * GET  /api/governance/fee-templates          — List active fee templates
 * POST /api/governance/fee-templates          — Create or update a fee template
 *
 * POST body (create):
 *   { name, amount, frequency?, applicableGrade? }
 *
 * POST body (update):
 *   { id, name?, amount?, frequency?, applicableGrade?, isActive? }
 */

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const templates = await getFeeTemplates(guard.organizationId!);
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch fee templates" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();

    if (body.id) {
      const { id, ...data } = body;
      const result = await updateFeeTemplate(id, data);
      return NextResponse.json(result);
    }

    if (!body.name || body.amount === undefined) {
      return NextResponse.json(
        { error: "name and amount are required" },
        { status: 400 },
      );
    }

    const result = await createFeeTemplate({
      organizationId: guard.organizationId!,
      name: body.name,
      amount: body.amount,
      frequency: body.frequency,
      applicableGrade: body.applicableGrade,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save fee template" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 },
      );
    }

    await deleteFeeTemplate(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete fee template" },
      { status: 500 },
    );
  }
}
