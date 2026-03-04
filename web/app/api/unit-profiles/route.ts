import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { updateUnitProfileSchema } from "@/lib/validations/unit-profile";
import { getUnitProfile, updateUnitProfile } from "@/lib/services/unit-profile.service";
import type { UnitScopeType } from "@/lib/generated/prisma";

const UNIT_SCOPE_TYPES = ["REGION", "SUBREGION", "CITY", "ZONE", "CAMPUS"] as const;

function isValidUnitType(v: string): v is UnitScopeType {
  return (UNIT_SCOPE_TYPES as readonly string[]).includes(v);
}

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const unitType = searchParams.get("unitType") ?? "";
    const unitId = searchParams.get("unitId") ?? "";

    if (!isValidUnitType(unitType) || !unitId) {
      return NextResponse.json(
        { ok: false, error: "Missing unitType or unitId" },
        { status: 400 },
      );
    }

    const profile = await getUnitProfile(unitType, unitId);

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Unit profile not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, profile.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    return NextResponse.json({ ok: true, data: profile });
  } catch (error) {
    console.error("UnitProfile GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch unit profile" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = updateUnitProfileSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const existing = await getUnitProfile(
      parsed.data.unitType as UnitScopeType,
      parsed.data.unitId,
    );

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Unit profile not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, existing.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    const updated = await updateUnitProfile(parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("UnitProfile PUT error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update unit profile" },
      { status: 500 },
    );
  }
}
