import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import RegistrationPDF from "@/lib/pdf/RegistrationPDF";
import React from "react";

function generateCertNo(orgId: string, createdAt: Date): string {
  const year = createdAt.getFullYear();
  const seq = orgId.replace(/\D/g, "").padStart(6, "0");
  return `SRC-${year}-${seq}`;
}

/**
 * GET /api/onboarding/certificate
 * Streams a 2-page landscape PDF: Registration Certificate + Organization Profile.
 * Source of truth is always the database.
 */
export async function GET() {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  const orgId = guard.organizationId;

  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: guard.id, organizationId: orgId, status: "ACTIVE" },
    });

    const isSuperAdmin = guard.platformRole === "SUPER_ADMIN";
    if (!membership && !isSuperAdmin) {
      return NextResponse.json(
        { error: "You do not have access to this organization" },
        { status: 403 },
      );
    }

    const certNo = generateCertNo(orgId, org.createdAt);
    const verifyUrl = `sms.sairex.edu.pk/verify/${certNo}`;
    const verifyFullUrl = `https://${verifyUrl}`;

    let qrDataUrl: string | undefined;
    try {
      qrDataUrl = await QRCode.toDataURL(verifyFullUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#111827", light: "#ffffff" },
      });
    } catch {
      // QR generation is best-effort
    }

    const buffer = await renderToBuffer(
      <RegistrationPDF org={org} qrDataUrl={qrDataUrl} verifyUrl={verifyUrl} />,
    );
    const body = Uint8Array.from(buffer);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${orgId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Certificate PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 },
    );
  }
}
