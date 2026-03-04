import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { createUnitAddressSchema } from "@/lib/validations/unit-address";
import {
  getUnitProfile,
  listAddresses,
  createAddress,
} from "@/lib/services/unit-profile.service";
import type { UnitScopeType } from "@/lib/generated/prisma";

async function resolveProfile(unitType: string, unitId: string) {
  return getUnitProfile(unitType as UnitScopeType, unitId);
}

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const unitType = searchParams.get("unitType") ?? "";
    const unitId = searchParams.get("unitId") ?? "";

    if (!unitType || !unitId) {
      return NextResponse.json(
        { ok: false, error: "Missing unitType or unitId" },
        { status: 400 },
      );
    }

    const profile = await resolveProfile(unitType, unitId);
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

    const addresses = await listAddresses(profile.id);
    return NextResponse.json({ ok: true, data: addresses });
  } catch (error) {
    console.error("UnitAddress GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch addresses" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = createUnitAddressSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const { unitType, unitId, ...addressData } = parsed.data;

    const profile = await resolveProfile(unitType, unitId);
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

    const address = await createAddress(profile.id, addressData);
    return NextResponse.json({ ok: true, data: address }, { status: 201 });
  } catch (error) {
    console.error("UnitAddress POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create address" },
      { status: 500 },
    );
  }
}
