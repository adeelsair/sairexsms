import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { updateUnitBankSchema } from "@/lib/validations/unit-bank";
import {
  updateBankAccount,
  archiveBankAccount,
} from "@/lib/services/unit-profile.service";

type RouteContext = { params: Promise<{ id: string }> };

async function getAccountWithOwnership(accountId: string) {
  return prisma.unitBankAccount.findUnique({
    where: { id: accountId },
    include: {
      unitProfile: { select: { id: true, organizationId: true } },
    },
  });
}

export async function PUT(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await ctx.params;
    const account = await getAccountWithOwnership(id);

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Bank account not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(
        guard,
        account.unitProfile.organizationId,
      );
      if (ownerCheck) return ownerCheck;
    }

    const body = await request.json();
    const parsed = updateUnitBankSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const updated = await updateBankAccount(
      id,
      account.unitProfile.id,
      parsed.data,
    );
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("UnitBankAccount PUT error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update bank account" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await ctx.params;
    const account = await getAccountWithOwnership(id);

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Bank account not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(
        guard,
        account.unitProfile.organizationId,
      );
      if (ownerCheck) return ownerCheck;
    }

    const archived = await archiveBankAccount(id);
    return NextResponse.json({ ok: true, data: archived });
  } catch (error) {
    console.error("UnitBankAccount DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to archive bank account" },
      { status: 500 },
    );
  }
}
