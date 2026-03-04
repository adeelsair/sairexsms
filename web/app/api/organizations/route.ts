import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { generateOrganizationId } from "@/lib/id-generators";
import { createOrganizationSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const where = isSuperAdmin(guard)
      ? {}
      : { id: guard.organizationId ?? undefined };

    const orgs = await prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orgs);
  } catch (error) {
    logger.error({ err: error, userId: guard.id, orgId: guard.organizationId }, "Failed to fetch organizations");
    return NextResponse.json(
      { error: "Failed to fetch orgs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();

    const parsed = createOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const existingSlug = await prisma.organization.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (existingSlug) {
      return NextResponse.json(
        { errors: { slug: ["This slug is already taken"] } },
        { status: 409 },
      );
    }

    const orgId = await generateOrganizationId();
    const trialWindow = createTrialWindow();

    const newOrg = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          id: orgId,
          createdByUserId: guard.id,
          organizationName: parsed.data.organizationName,
          displayName: parsed.data.displayName,
          slug: parsed.data.slug,
          organizationCategory: parsed.data.organizationCategory,
          organizationStructure: parsed.data.organizationStructure,
          status: parsed.data.status,
          onboardingStep: "COMPLETED",
        },
      });

      await tx.organizationPlan.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          planType: "FREE",
          active: true,
          trialPlanType: TRIAL_POLICY.trialPlanType,
          trialStartedAt: trialWindow.trialStartedAt,
          trialEndsAt: trialWindow.trialEndsAt,
        },
        update: {},
      });

      return org;
    });

    logger.info({ orgId: newOrg.id, slug: newOrg.slug, userId: guard.id }, "Organization created");
    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    logger.error({ err: error, userId: guard.id }, "Failed to create organization");
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}
