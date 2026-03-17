import { NextResponse } from "next/server";
import { requireVerifiedAuth } from "@/lib/auth-guard";
import { verifyNtnCertificate } from "@/lib/onboarding/verify-ntn-cert";

/**
 * POST /api/onboarding/verify-ntn
 *
 * Verifies that the uploaded NTN certificate PDF contains the given NTN number
 * (and optionally organization name). Used when leaving the legal step so the
 * user cannot proceed without a matching certificate.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const {
      ntnCertificate,
      taxNumber,
      organizationName = "",
    } = body as {
      ntnCertificate?: string;
      taxNumber?: string;
      organizationName?: string;
    };

    if (!ntnCertificate || typeof ntnCertificate !== "string") {
      return NextResponse.json(
        { ok: false, message: "NTN certificate is required." },
        { status: 400 },
      );
    }

    if (!taxNumber || typeof taxNumber !== "string") {
      return NextResponse.json(
        { ok: false, message: "NTN / Tax number is required." },
        { status: 400 },
      );
    }

    const verify = await verifyNtnCertificate(
      ntnCertificate,
      taxNumber.trim().replace(/\s+/g, ""),
      typeof organizationName === "string" ? organizationName : "",
    );

    if (!verify.ok) {
      return NextResponse.json(
        { ok: false, message: verify.message ?? "Certificate verification failed." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Verify NTN error:", error);
    return NextResponse.json(
      { ok: false, message: "Verification failed. Please try again." },
      { status: 500 },
    );
  }
}
