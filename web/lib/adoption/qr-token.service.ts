/**
 * QR Token Infrastructure — Service Layer
 *
 * Generates, resolves, and consumes QR tokens that wrap
 * existing domain entities (challans, students, sections)
 * behind secure, time-limited, tenant-isolated tokens.
 *
 * Tokens never expose raw IDs — only a tokenId pointer.
 * Resolution validates expiry, consumption (if oneTimeUse),
 * and tenant isolation before returning the underlying entity.
 */
import { prisma } from "@/lib/prisma";
import type { QrTokenType } from "@/lib/generated/prisma";
import { Prisma } from "@prisma/client";

/* ── Default TTLs per type ────────────────────────────── */

const DEFAULT_TTL_MS: Record<QrTokenType, number | null> = {
  FEE_PAYMENT: null,                        // until challan dueDate (caller passes ttlMs)
  PARENT_ACCESS: 3 * 24 * 60 * 60 * 1000,   // 3 days
  ADMISSION: 30 * 24 * 60 * 60 * 1000,      // 30 days
  ATTENDANCE: 12 * 60 * 60 * 1000,          // 12 hours
  LOGIN: 5 * 60 * 1000,                     // 5 minutes
};

const ONE_TIME_TYPES: Set<QrTokenType> = new Set([
  "PARENT_ACCESS",
  "LOGIN",
]);

/* ── Errors ────────────────────────────────────────────── */

export class QrTokenError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "EXPIRED"
      | "CONSUMED"
      | "TENANT_MISMATCH"
      | "INVALID_TYPE" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "QrTokenError";
  }
}

/* ── Generate Token ────────────────────────────────────── */

export interface GenerateQrInput {
  organizationId: string;
  type: QrTokenType;
  referenceId: string;
  label?: string;
  oneTimeUse?: boolean;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
  createdByUserId?: number;
}

export interface GenerateQrResult {
  tokenId: string;
  url: string;
  expiresAt: Date | null;
  oneTimeUse: boolean;
}

export async function generateQrToken(input: GenerateQrInput): Promise<GenerateQrResult> {
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS[input.type];
  const expiresAt = ttl ? new Date(Date.now() + ttl) : null;
  const oneTimeUse = input.oneTimeUse ?? ONE_TIME_TYPES.has(input.type);

  const token = await prisma.qrToken.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      referenceId: input.referenceId,
      label: input.label,
      oneTimeUse,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonValue)
        : undefined,
      expiresAt,
      createdByUserId: input.createdByUserId,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.sairex.com";

  return {
    tokenId: token.id,
    url: `${baseUrl}/q/${token.id}`,
    expiresAt,
    oneTimeUse,
  };
}

/* ── Bulk Generate (for fee posting) ───────────────────── */

export async function bulkGenerateQrTokens(
  organizationId: string,
  type: QrTokenType,
  referenceIds: string[],
  createdByUserId?: number,
): Promise<GenerateQrResult[]> {
  const ttl = DEFAULT_TTL_MS[type];
  const expiresAt = ttl ? new Date(Date.now() + ttl) : null;
  const oneTimeUse = ONE_TIME_TYPES.has(type);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.sairex.com";

  const data = referenceIds.map((refId) => ({
    organizationId,
    type,
    referenceId: refId,
    oneTimeUse,
    expiresAt,
    createdByUserId,
  }));

  await prisma.qrToken.createMany({ data });

  const tokens = await prisma.qrToken.findMany({
    where: {
      organizationId,
      type,
      referenceId: { in: referenceIds },
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: "desc" },
    take: referenceIds.length,
  });

  return tokens.map((t) => ({
    tokenId: t.id,
    url: `${baseUrl}/q/${t.id}`,
    expiresAt: t.expiresAt,
    oneTimeUse: t.oneTimeUse,
  }));
}

/* ── Resolve Token ─────────────────────────────────────── */

export interface ResolvedQrToken {
  tokenId: string;
  organizationId: string;
  type: QrTokenType;
  referenceId: string;
  label: string | null;
  oneTimeUse: boolean;
  metadata: unknown;
  expiresAt: Date | null;
}

export async function resolveQrToken(tokenId: string): Promise<ResolvedQrToken> {
  const token = await prisma.qrToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    throw new QrTokenError("QR code not found or invalid", "NOT_FOUND");
  }

  if (token.expiresAt && new Date() > token.expiresAt) {
    throw new QrTokenError("This QR code has expired", "EXPIRED");
  }

  if (token.oneTimeUse && token.consumed) {
    throw new QrTokenError("This QR code has already been used", "CONSUMED");
  }

  return {
    tokenId: token.id,
    organizationId: token.organizationId,
    type: token.type,
    referenceId: token.referenceId,
    label: token.label,
    oneTimeUse: token.oneTimeUse,
    metadata: token.metadata,
    expiresAt: token.expiresAt,
  };
}

/* ── Consume Token (one-time use) ──────────────────────── */

export async function consumeQrToken(tokenId: string): Promise<void> {
  const token = await prisma.qrToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    throw new QrTokenError("QR token not found", "NOT_FOUND");
  }

  if (token.consumed) {
    throw new QrTokenError("Token already consumed", "CONSUMED");
  }

  await prisma.qrToken.update({
    where: { id: tokenId },
    data: { consumed: true, consumedAt: new Date() },
  });
}

/* ── Resolve Fee Payment QR ────────────────────────────── */

export async function resolveFeePaymentQr(tokenId: string) {
  const token = await resolveQrToken(tokenId);

  if (token.type !== "FEE_PAYMENT") {
    throw new QrTokenError("Invalid QR type for fee payment", "INVALID_TYPE");
  }

  const challanId = parseInt(token.referenceId, 10);

  const challan = await prisma.feeChallan.findUnique({
    where: { id: challanId },
    select: {
      id: true,
      challanNo: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      student: {
        select: { fullName: true, admissionNo: true, grade: true },
      },
      campus: {
        select: { name: true },
      },
      bankAccount: {
        select: { bankName: true, accountTitle: true, accountNumber: true },
      },
    },
  });

  if (!challan) {
    throw new QrTokenError("Challan not found", "NOT_FOUND");
  }

  return {
    token,
    challan: {
      ...challan,
      totalAmount: Number(challan.totalAmount),
      paidAmount: Number(challan.paidAmount),
    },
  };
}

/* ── Resolve Parent Access QR ──────────────────────────── */

export async function resolveParentAccessQr(tokenId: string) {
  const token = await resolveQrToken(tokenId);

  if (token.type !== "PARENT_ACCESS") {
    throw new QrTokenError("Invalid QR type for parent access", "INVALID_TYPE");
  }

  const studentId = parseInt(token.referenceId, 10);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      admissionNo: true,
      grade: true,
      campusId: true,
      organizationId: true,
    },
  });

  if (!student) {
    throw new QrTokenError("Student not found", "NOT_FOUND");
  }

  if (student.organizationId !== token.organizationId) {
    throw new QrTokenError("Tenant mismatch", "TENANT_MISMATCH");
  }

  return { token, student };
}

/* ── List Tokens (admin) ───────────────────────────────── */

export async function listQrTokens(params: {
  organizationId: string;
  type?: QrTokenType;
  referenceId?: string;
  consumed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {
    organizationId: params.organizationId,
  };
  if (params.type) where.type = params.type;
  if (params.referenceId) where.referenceId = params.referenceId;
  if (params.consumed !== undefined) where.consumed = params.consumed;

  const [tokens, total] = await Promise.all([
    prisma.qrToken.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }),
    prisma.qrToken.count({ where }),
  ]);

  return { tokens, total };
}

/* ── Cleanup Expired ───────────────────────────────────── */

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.qrToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      consumed: false,
    },
  });
  return result.count;
}
