import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invites/validate?token=xxx — public, no auth needed
 * Validates an invitation token and returns invite details.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { organizationName: true } } },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invite link" },
        { status: 404 },
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 400 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invite has expired. Please ask your admin for a new one." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      orgName: invitation.organization.organizationName,
    });
  } catch (error) {
    console.error("Invite validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate invite" },
      { status: 500 },
    );
  }
}
