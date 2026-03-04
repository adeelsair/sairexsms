import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import {
  getDefaulterList,
  type FinanceScope,
} from "@/lib/finance/defaulter.service";

const VALID_BUCKETS = new Set(["D30", "D60", "D90", "D90_PLUS"]);
const VALID_SORTS = new Set(["balance", "overdueDays", "name"]);

/**
 * GET /api/finance/defaulters?bucket=D60&minAmount=5000&campusId=1&sortBy=balance&sortDir=desc&limit=50&offset=0
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const scope: FinanceScope = { organizationId: orgId };

    if (!isSuperAdmin(guard) && guard.role !== "ORG_ADMIN" && guard.unitPath) {
      scope.unitPath = guard.unitPath;
    }

    const campusIdParam = searchParams.get("campusId");
    if (campusIdParam) {
      scope.campusId = parseInt(campusIdParam, 10);
    } else if (guard.campusId && guard.role === "CAMPUS_ADMIN") {
      scope.campusId = guard.campusId;
    }

    const bucketParam = searchParams.get("bucket");
    const bucket = bucketParam && VALID_BUCKETS.has(bucketParam)
      ? (bucketParam as "D30" | "D60" | "D90" | "D90_PLUS")
      : undefined;

    const minAmount = parseFloat(searchParams.get("minAmount") ?? "0") || 0;

    const sortByParam = searchParams.get("sortBy") ?? "balance";
    const sortBy = VALID_SORTS.has(sortByParam)
      ? (sortByParam as "balance" | "overdueDays" | "name")
      : "balance";

    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    const result = await getDefaulterList({
      scope,
      bucket,
      minAmount,
      sortBy,
      sortDir,
      limit,
      offset,
    });

    return NextResponse.json({ ok: true, data: result.defaulters, total: result.total });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch defaulters";
    console.error("Defaulter list error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
