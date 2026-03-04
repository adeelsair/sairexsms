import QRCode from "qrcode";
import { Prisma } from "@prisma/client";

import { verifyOtp } from "@/lib/adoption/otp.service";
import { prisma } from "@/lib/prisma";

type InviteRole = "PARENT" | "STAFF";

type InviteMetadata = {
  studentId?: number;
};

export class QRInviteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "EXPIRED"
      | "LIMIT_REACHED"
      | "INVALID_ROLE"
      | "STUDENT_REQUIRED"
      | "STUDENT_NOT_FOUND"
      | "OTP_INVALID",
  ) {
    super(message);
    this.name = "QRInviteError";
  }
}

export async function generateQRInviteToken(input: {
  organizationId: string;
  role: InviteRole;
  expiresInDays?: number;
  maxUses?: number;
  metadata?: InviteMetadata;
}) {
  const days = input.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = await prisma.qRInviteToken.create({
    data: {
      organizationId: input.organizationId,
      role: input.role,
      expiresAt,
      maxUses: input.maxUses ?? null,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sairex.com";
  const joinUrl = `${baseUrl}/join?token=${token.id}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });

  return {
    tokenId: token.id,
    joinUrl,
    qrDataUrl,
    role: token.role,
    expiresAt: token.expiresAt,
    maxUses: token.maxUses,
    usedCount: token.usedCount,
  };
}

export async function resolveQRInviteToken(tokenId: string) {
  const token = await prisma.qRInviteToken.findUnique({
    where: { id: tokenId },
    select: {
      id: true,
      organizationId: true,
      role: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (!token) {
    throw new QRInviteError("Invite token not found", "NOT_FOUND");
  }
  if (new Date() > token.expiresAt) {
    throw new QRInviteError("Invite token expired", "EXPIRED");
  }
  if (token.maxUses != null && token.usedCount >= token.maxUses) {
    throw new QRInviteError("Invite usage limit reached", "LIMIT_REACHED");
  }

  const metadata = (token.metadata ?? {}) as InviteMetadata;
  return { ...token, metadata };
}

export async function claimQRInvite(input: {
  tokenId: string;
  otpSessionId: string;
  code: string;
  studentId?: number;
  admissionNo?: string;
}) {
  const invite = await resolveQRInviteToken(input.tokenId);
  if (invite.role !== "PARENT" && invite.role !== "STAFF") {
    throw new QRInviteError("Invalid invite role", "INVALID_ROLE");
  }

  const otp = await verifyOtp({
    otpSessionId: input.otpSessionId,
    code: input.code,
  }).catch(() => {
    throw new QRInviteError("OTP verification failed", "OTP_INVALID");
  });

  let campusId: number | null = null;

  if (invite.role === "PARENT") {
    const lookupStudentId = input.studentId ?? invite.metadata.studentId;
    const student = lookupStudentId
      ? await prisma.student.findFirst({
          where: {
            id: lookupStudentId,
            organizationId: invite.organizationId,
          },
          select: { id: true, campusId: true },
        })
      : input.admissionNo
        ? await prisma.student.findFirst({
            where: {
              admissionNo: input.admissionNo,
              organizationId: invite.organizationId,
            },
            select: { id: true, campusId: true },
          })
        : null;

    if (!student) {
      throw new QRInviteError(
        "Student is required for parent invite",
        "STUDENT_REQUIRED",
      );
    }
    campusId = student.campusId;
  }

  const existing = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: otp.userId,
        organizationId: invite.organizationId,
      },
    },
    select: { id: true, role: true },
  });

  let membershipId = existing?.id;
  if (!existing) {
    const membership = await prisma.membership.create({
      data: {
        userId: otp.userId,
        organizationId: invite.organizationId,
        role: invite.role,
        status: "ACTIVE",
        campusId,
      },
      select: { id: true },
    });
    membershipId = membership.id;
  }

  const usageUpdate = await prisma.qRInviteToken.updateMany({
    where: {
      id: invite.id,
      expiresAt: { gt: new Date() },
      OR: [{ maxUses: null }, { usedCount: { lt: invite.maxUses ?? Number.MAX_SAFE_INTEGER } }],
    },
    data: {
      usedCount: { increment: 1 },
    },
  });

  if (!usageUpdate.count) {
    throw new QRInviteError("Invite usage limit reached", "LIMIT_REACHED");
  }

  return {
    success: true,
    userId: otp.userId,
    role: invite.role,
    membershipId,
  };
}
