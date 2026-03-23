import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { getObjectStorage, isObjectStorageConfigured, parseStoredObjectRef } from "@/lib/storage";

/**
 * GET /api/admin/legal-certificates/signed-url?kind=registration|ntn
 *
 * Short-lived signed GET URL for private object keys (`tenants/.../certificates/...`).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  if (!guard.organizationId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "registration" && kind !== "ntn") {
    return NextResponse.json({ error: "Query kind must be registration or ntn" }, { status: 400 });
  }

  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: "Object storage is not configured" }, { status: 503 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: guard.organizationId },
    select: { registrationCertificateUrl: true, ntnCertificateUrl: true },
  });

  const raw =
    kind === "ntn" ? org?.ntnCertificateUrl ?? null : org?.registrationCertificateUrl ?? null;
  const parsed = parseStoredObjectRef(raw);

  if (!parsed || parsed.kind !== "object-key") {
    return NextResponse.json(
      { error: "This certificate is not stored as a private object key (legacy URL or data URL)." },
      { status: 400 },
    );
  }

  try {
    const url = await getObjectStorage().getSignedGetUrl(parsed.key);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[legal-certificates/signed-url]", e);
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}
