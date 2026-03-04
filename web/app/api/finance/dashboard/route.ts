import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { getFinanceDashboardData } from "@/lib/billing/finance-dashboard.service";
import type { PlanType, RevenueCalculationMode } from "@/lib/generated/prisma";

const ALLOWED_REVENUE_MODES: Array<RevenueCalculationMode | "ALL"> = [
  "ALL",
  "ON_GENERATED_FEE",
  "ON_COLLECTED_FEE",
];

const ALLOWED_PLAN_TYPES: Array<PlanType | "ALL"> = [
  "ALL",
  "FREE",
  "BASIC",
  "PRO",
  "ENTERPRISE",
];

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const monthRaw = searchParams.get("month");
    const yearRaw = searchParams.get("year");
    const revenueModeRaw = (searchParams.get("revenueMode") ?? "ALL") as
      | RevenueCalculationMode
      | "ALL";
    const planTypeRaw = (searchParams.get("planType") ?? "ALL") as PlanType | "ALL";

    const month = monthRaw ? Number(monthRaw) : undefined;
    const year = yearRaw ? Number(yearRaw) : undefined;

    if (month && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return NextResponse.json(
        { ok: false, error: "month must be between 1 and 12" },
        { status: 400 },
      );
    }

    if (year && (!Number.isInteger(year) || year < 2000 || year > 3000)) {
      return NextResponse.json(
        { ok: false, error: "year must be between 2000 and 3000" },
        { status: 400 },
      );
    }

    if (!ALLOWED_REVENUE_MODES.includes(revenueModeRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid revenueMode filter" },
        { status: 400 },
      );
    }

    if (!ALLOWED_PLAN_TYPES.includes(planTypeRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid planType filter" },
        { status: 400 },
      );
    }

    const data = await getFinanceDashboardData({
      month,
      year,
      revenueMode: revenueModeRaw,
      planType: planTypeRaw,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load finance dashboard";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
