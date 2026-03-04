import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { academicSetupSchema } from "@/lib/validations/onboarding-wizard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = academicSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid academic setup",
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
        academicSetup: {
          classes: parsed.data.classes,
          sectionsPerClass: parsed.data.sectionsPerClass,
        },
      },
    });

    return NextResponse.json({ ok: true, token: parsed.data.token });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save academic setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
