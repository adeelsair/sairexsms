import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateOrganizationId } from "@/lib/id-generators";

/**
 * GET /api/organizations/next-id
 * Returns the next auto-generated Organization ID (preview).
 * SUPER_ADMIN only.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const nextId = await generateOrganizationId();
    return NextResponse.json({ nextId });
  } catch (error) {
    console.error("Failed to generate next ID:", error);
    return NextResponse.json(
      { error: "Failed to generate ID" },
      { status: 500 },
    );
  }
}
