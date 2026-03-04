import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  createOrganizationAddressSchema,
  updateOrganizationAddressSchema,
} from "@/lib/validations";

// ─── GET: List addresses for an organization ─────────────────────────────────

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  try {
    const addresses = await prisma.organizationAddress.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    console.error("Failed to fetch addresses:", error);
    return NextResponse.json(
      { error: "Failed to fetch addresses" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new address ──────────────────────────────────────────────

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const parsed = createOrganizationAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.isPrimary) {
      await prisma.organizationAddress.updateMany({
        where: {
          organizationId: orgId,
          type: parsed.data.type,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const address = await prisma.organizationAddress.create({
      data: {
        ...parsed.data,
        organizationId: orgId,
      },
    });

    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    console.error("Failed to create address:", error);
    return NextResponse.json(
      { error: "Failed to create address" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing address ─────────────────────────────────────────

export async function PUT(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { addressId, ...updateData } = body;

    if (!addressId) {
      return NextResponse.json(
        { error: "addressId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.organizationAddress.findUnique({
      where: { id: parseInt(addressId) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    if (existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Address does not belong to this organization" },
        { status: 403 }
      );
    }

    const parsed = updateOrganizationAddressSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const effectiveType = parsed.data.type || existing.type;
    if (parsed.data.isPrimary) {
      await prisma.organizationAddress.updateMany({
        where: {
          organizationId: orgId,
          type: effectiveType,
          isPrimary: true,
          id: { not: existing.id },
        },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.organizationAddress.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update address:", error);
    return NextResponse.json(
      { error: "Failed to update address" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove an address ───────────────────────────────────────────────

export async function DELETE(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get("addressId");

    if (!addressId) {
      return NextResponse.json(
        { error: "addressId query param is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.organizationAddress.findUnique({
      where: { id: parseInt(addressId) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    if (existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Address does not belong to this organization" },
        { status: 403 }
      );
    }

    await prisma.organizationAddress.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error("Failed to delete address:", error);
    return NextResponse.json(
      { error: "Failed to delete address" },
      { status: 500 }
    );
  }
}
