import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  createOrganizationContactSchema,
  updateOrganizationContactSchema,
} from "@/lib/validations";

// ─── GET: List contacts for an organization ──────────────────────────────────

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
    const contacts = await prisma.organizationContact.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new contact ──────────────────────────────────────────────

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

    const parsed = createOrganizationContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.isPrimary) {
      await prisma.organizationContact.updateMany({
        where: { organizationId: orgId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.organizationContact.create({
      data: {
        ...parsed.data,
        organizationId: orgId,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Failed to create contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing contact ─────────────────────────────────────────

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
    const { contactId, ...updateData } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.organizationContact.findUnique({
      where: { id: parseInt(contactId) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Contact does not belong to this organization" },
        { status: 403 }
      );
    }

    const parsed = updateOrganizationContactSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.isPrimary) {
      await prisma.organizationContact.updateMany({
        where: { organizationId: orgId, isPrimary: true, id: { not: existing.id } },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.organizationContact.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove a contact ────────────────────────────────────────────────

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
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId query param is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.organizationContact.findUnique({
      where: { id: parseInt(contactId) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Contact does not belong to this organization" },
        { status: 403 }
      );
    }

    await prisma.organizationContact.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("Failed to delete contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
