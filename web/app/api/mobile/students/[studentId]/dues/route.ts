import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  listOutstandingChallansByStudent,
  PaymentEntryError,
} from "@/lib/finance/payment-entry.service";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    return guard;
  }

  const roleCheck = requireRole(
    guard,
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "CAMPUS_ADMIN",
    "ACCOUNTANT",
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

    const { studentId: studentIdRaw } = await context.params;
    const studentId = Number(studentIdRaw);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }

    const scope = {
      organizationId,
      campusId: guard.campusId ?? undefined,
      unitPath: guard.unitPath,
    };

    const challans = await listOutstandingChallansByStudent(scope, studentId);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalDue = challans.reduce((sum, row) => sum + row.balance, 0);
    const currentMonthDue = challans
      .filter((row) => {
        const dueDate = new Date(row.dueDate);
        return (
          dueDate.getMonth() === currentMonth &&
          dueDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, row) => sum + row.balance, 0);

    const suggestedChallan =
      challans.find((row) => {
        const dueDate = new Date(row.dueDate);
        return (
          dueDate.getMonth() === currentMonth &&
          dueDate.getFullYear() === currentYear
        );
      }) ?? challans[0];

    const suggestedAmount =
      currentMonthDue > 0
        ? currentMonthDue
        : Number(suggestedChallan?.balance ?? 0);

    return NextResponse.json({
      studentId,
      totalDue,
      currentMonthDue,
      fine: 0,
      suggestedAmount,
      suggestedChallanId: suggestedChallan?.id ?? null,
      challans,
    });
  } catch (error: unknown) {
    if (error instanceof PaymentEntryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to fetch student dues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
