import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { updateUnitAddressSchema } from "@/lib/validations/unit-address";
import { updateAddress, deleteAddress } from "@/lib/services/unit-profile.service";

type RouteContext = { params: Promise<{ id: string }> };

async function getAddressWithOwnership(addressId: string) {
  return prisma.unitAddress.findUnique({
    where: { id: addressId },
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
    const address = await getAddressWithOwnership(id);

    if (!address) {
      return NextResponse.json(
        { ok: false, error: "Address not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, address.unitProfile.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    const body = await request.json();
    const parsed = updateUnitAddressSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const updated = await updateAddress(id, address.unitProfile.id, parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("UnitAddress PUT error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update address" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await ctx.params;
    const address = await getAddressWithOwnership(id);

    if (!address) {
      return NextResponse.json(
        { ok: false, error: "Address not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, address.unitProfile.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    await deleteAddress(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("UnitAddress DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete address" },
      { status: 500 },
    );
  }
}
