import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  PaymentEntryError,
  searchStudentsForPayments,
} from "@/lib/finance/payment-entry.service";

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
    "ACCOUNTANT",
  );
  if (roleCheck) {
    return roleCheck;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limit = Number(searchParams.get("limit") ?? 15);
    const organizationId = guard.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    const scope = {
      organizationId,
      campusId: guard.campusId ?? undefined,
      unitPath: guard.unitPath,
    };

    const data = await searchStudentsForPayments(scope, query, limit);
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof PaymentEntryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to search students";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
