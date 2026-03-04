import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";
import { updateUnitContactSchema } from "@/lib/validations/unit-contact";
import { updateContact, deleteContact } from "@/lib/services/unit-profile.service";

type RouteContext = { params: Promise<{ id: string }> };

async function getContactWithOwnership(contactId: string) {
  return prisma.unitContact.findUnique({
    where: { id: contactId },
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
    const contact = await getContactWithOwnership(id);

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, contact.unitProfile.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    const body = await request.json();
    const parsed = updateUnitContactSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
    }

    const updated = await updateContact(id, contact.unitProfile.id, parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("UnitContact PUT error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update contact" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await ctx.params;
    const contact = await getContactWithOwnership(id);

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: "Contact not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard)) {
      const ownerCheck = assertOwnership(guard, contact.unitProfile.organizationId);
      if (ownerCheck) return ownerCheck;
    }

    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("UnitContact DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
