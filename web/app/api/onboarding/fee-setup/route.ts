import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { feeSetupSchema } from "@/lib/validations/onboarding-wizard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = feeSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid fee setup",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const draft = await prisma.onboardingDraft.findUnique({
      where: { token: parsed.data.token },
      select: { id: true },
    });
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await prisma.onboardingDraft.update({
      where: { token: parsed.data.token },
      data: {
        feeSetup: {
          averageMonthlyFee: parsed.data.averageMonthlyFee,
        },
      },
    });

    return NextResponse.json({ ok: true, token: parsed.data.token });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save fee setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
