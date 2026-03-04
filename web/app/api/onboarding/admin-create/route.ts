import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { adminCreateSchema } from "@/lib/validations/onboarding-wizard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid admin setup",
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
        adminSetup: {
          adminName: parsed.data.adminName,
          mobile: parsed.data.mobile,
        },
      },
    });

    return NextResponse.json({ ok: true, token: parsed.data.token });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save admin setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
