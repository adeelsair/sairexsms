import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import type { PaymentChannel } from "@/lib/generated/prisma";
import {
  getStudentFinancialSummary,
  listOutstandingChallansByStudent,
  reconcilePayment,
  searchStudentsForPayments,
  PaymentEntryError,
} from "@/lib/finance/payment-entry.service";

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "students";

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const campusIdParam = searchParams.get("campusId");
    const scope = {
      organizationId: orgId,
      campusId: campusIdParam ? Number(campusIdParam) : guard.campusId ?? undefined,
      unitPath: guard.unitPath,
    };

    if (view === "students") {
      const search = searchParams.get("search") ?? "";
      const data = await searchStudentsForPayments(
        scope,
        search,
        searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      );
      return NextResponse.json({ ok: true, data });
    }

    const studentId = Number(searchParams.get("studentId"));
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json(
        { ok: false, error: "studentId query parameter is required" },
        { status: 400 },
      );
    }

    if (view === "summary") {
      const data = await getStudentFinancialSummary(scope, studentId);
      return NextResponse.json({ ok: true, data });
    }

    if (view === "challans") {
      const data = await listOutstandingChallansByStudent(scope, studentId);
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid view parameter" },
      { status: 400 },
    );
  } catch (error: unknown) {
    if (error instanceof PaymentEntryError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch payments data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const auditActor = resolveAuditActor(guard);
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const challanId = Number(body.challanId);
    const amount = Number(body.amount);
    const paymentDate = body.paymentDate ? new Date(String(body.paymentDate)) : null;
    const paymentChannel = String(body.paymentMethod) as PaymentChannel;

    if (!challanId || !amount || !paymentDate || Number.isNaN(paymentDate.getTime()) || !paymentChannel) {
      return NextResponse.json(
        { ok: false, error: "challanId, amount, paymentDate, and paymentMethod are required" },
        { status: 400 },
      );
    }

    const data = await reconcilePayment({
      organizationId: orgId,
      challanId,
      amount,
      paymentDate,
      paymentChannel,
      referenceNumber: (body.referenceNumber as string | undefined)?.trim() || undefined,
      notes: (body.notes as string | undefined)?.trim() || undefined,
      auditActor,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof PaymentEntryError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to reconcile payment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

