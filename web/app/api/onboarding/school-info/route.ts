import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { schoolInfoSchema } from "@/lib/validations/onboarding-wizard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schoolInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid school info", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const token = parsed.data.token ?? createId();

    const existing = await prisma.onboardingDraft.findUnique({
      where: { token },
      select: { id: true },
    });

    const schoolInfo = {
      schoolName: parsed.data.schoolName,
      city: parsed.data.city,
      contactNumber: parsed.data.contactNumber,
      approxStudents: parsed.data.approxStudents,
    };

    if (existing) {
      await prisma.onboardingDraft.update({
        where: { token },
        data: { schoolInfo },
      });
    } else {
      await prisma.onboardingDraft.create({
        data: {
          token,
          schoolInfo,
        },
      });
    }

    return NextResponse.json({ ok: true, token });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save school info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
