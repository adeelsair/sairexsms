import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { createUnitBankSchema } from "@/lib/validations/unit-bank";
import {
  getUnitProfile,
  listBankAccounts,
  createBankAccount,
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

    const accounts = await listBankAccounts(profile.id);
    return NextResponse.json({ ok: true, data: accounts });
  } catch (error) {
    console.error("UnitBankAccount GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch bank accounts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = createUnitBankSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const { unitType, unitId, ...bankData } = parsed.data;

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

    const account = await createBankAccount(
      profile.id,
      bankData,
    );
    return NextResponse.json({ ok: true, data: account }, { status: 201 });
  } catch (error) {
    console.error("UnitBankAccount POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create bank account" },
      { status: 500 },
    );
  }
}
