import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveParentAccessQr,
  consumeQrToken,
  QrTokenError,
} from "@/lib/adoption/qr-token.service";
import { emit } from "@/lib/events";

/**
 * POST /api/adoption/parent-access
 *
 * Links a phone-authenticated user to a student as a PARENT.
 * Requires a valid QR token of type PARENT_ACCESS.
 *
 * Body: { tokenId: string, userId: number }
 * Returns: { success, membershipId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenId, userId } = body;

    if (!tokenId || !userId) {
      return NextResponse.json(
        { error: "tokenId and userId are required" },
        { status: 400 },
      );
    }

    const { token, student } = await resolveParentAccessQr(tokenId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: token.organizationId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json({
        success: true,
        membershipId: existingMembership.id,
        message: "User already has access to this organization",
      });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: token.organizationId,
        role: "PARENT",
        status: "ACTIVE",
        campusId: student.campusId,
      },
    });

    await consumeQrToken(tokenId);

    emit("ParentAccessCreated", token.organizationId, {
      userId: user.id,
      membershipId: membership.id,
      studentId: student.id,
      campusId: student.campusId,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      membershipId: membership.id,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof QrTokenError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        EXPIRED: 410,
        CONSUMED: 410,
        INVALID_TYPE: 400,
      };
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 400 },
      );
    }
    console.error("[Parent Access] Error:", err);
    return NextResponse.json({ error: "Failed to create parent access" }, { status: 500 });
  }
}
