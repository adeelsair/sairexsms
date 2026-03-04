import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const blocked = applyRateLimit(request, "onboarding:wizard-read", RATE_LIMITS.QR_RESOLVE);
  if (blocked) return blocked;

  try {
    const { token } = await context.params;
    const draft = await prisma.onboardingDraft.findUnique({
      where: { token },
      select: {
        token: true,
        schoolInfo: true,
        academicSetup: true,
        feeSetup: true,
        adminSetup: true,
        status: true,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load onboarding draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
