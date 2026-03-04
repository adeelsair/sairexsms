import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateQRInviteToken } from "@/lib/adoption/qr-invite.service";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const generateInviteSchema = z.object({
  role: z.enum(["PARENT", "STAFF"]),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(5000).optional(),
  studentId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "invite:generate", RATE_LIMITS.API_GENERAL);
  if (blocked) return blocked;

  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (denied) return denied;

  if (!guard.organizationId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = generateInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const invite = await generateQRInviteToken({
      organizationId: guard.organizationId,
      role: parsed.data.role,
      expiresInDays: parsed.data.expiresInDays,
      maxUses: parsed.data.maxUses,
      metadata: parsed.data.studentId ? { studentId: parsed.data.studentId } : undefined,
    });

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    console.error("[Invite Generate] Failed:", error);
    return NextResponse.json({ error: "Failed to generate invite QR" }, { status: 500 });
  }
}
