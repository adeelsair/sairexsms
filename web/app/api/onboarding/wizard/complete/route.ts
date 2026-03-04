import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { generateOrganizationId } from "@/lib/id-generators";
import { generateUnitCode, generateCityCode, buildFullUnitPath } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import { onboardingCompleteWizardSchema } from "@/lib/validations/onboarding-wizard";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type SchoolInfo = {
  schoolName: string;
  city: string;
  contactNumber: string;
  approxStudents: string;
};

type AcademicSetup = {
  classes: number[];
  sectionsPerClass: number;
};

type FeeSetup = {
  averageMonthlyFee: number;
};

type AdminSetup = {
  adminName: string;
  mobile: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function currentAcademicYearWindow() {
  const now = new Date();
  const year = now.getUTCFullYear();
  return {
    name: `${year}-${year + 1}`,
    startDate: new Date(Date.UTC(year, 7, 1)),
    endDate: new Date(Date.UTC(year + 1, 6, 31)),
  };
}

function resolveOnboardingMode(
  approxStudents: string,
  quickSetup: boolean,
): "SIMPLE" | "PRO" {
  if (quickSetup) return "SIMPLE";
  const rangeMatch = approxStudents.match(/(\d+)\s*-\s*(\d+)/);
  if (!rangeMatch) return "SIMPLE";
  const max = Number(rangeMatch[2]);
  return max < 800 ? "SIMPLE" : "PRO";
}

async function buildUniqueAdminEmail(baseMobile: string): Promise<string> {
  const digits = baseMobile.replace(/\D/g, "").slice(-10) || Date.now().toString();
  let candidate = `owner+${digits}@sairex.local`;
  let idx = 1;
  // Keep trying short deterministic variants until unique.
  for (;;) {
    const exists = await prisma.user.findUnique({
      where: { email: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `owner+${digits}-${idx}@sairex.local`;
    idx += 1;
  }
}

export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "onboarding:wizard-complete", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const parsed = onboardingCompleteWizardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid completion payload",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const token = parsed.data.token;
    const draft = await prisma.onboardingDraft.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        schoolInfo: true,
        academicSetup: true,
        feeSetup: true,
        adminSetup: true,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    if (draft.status === "COMPLETED") {
      return NextResponse.json({ error: "Draft already completed" }, { status: 409 });
    }

    const schoolInfo = draft.schoolInfo as SchoolInfo | null;
    const academicSetup = draft.academicSetup as AcademicSetup | null;
    const feeSetup = draft.feeSetup as FeeSetup | null;
    const adminSetup = draft.adminSetup as AdminSetup | null;

    if (!schoolInfo || !academicSetup || !feeSetup || !adminSetup) {
      return NextResponse.json(
        { error: "Incomplete onboarding draft. Please finish all steps." },
        { status: 400 },
      );
    }

    const password = body.password as string | undefined;
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password is required to complete setup" },
        { status: 400 },
      );
    }

    const orgId = await generateOrganizationId();
    const hashedPassword = await bcrypt.hash(password, 12);
    const adminEmail = await buildUniqueAdminEmail(adminSetup.mobile);
    const slugBase = slugify(schoolInfo.schoolName);
    const finalSlug = slugBase.length >= 3 ? slugBase : `school-${Date.now()}`;
    const yearInfo = currentAcademicYearWindow();
    const organizationMode = resolveOnboardingMode(schoolInfo.approxStudents, true);
    const trialWindow = createTrialWindow();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: adminSetup.adminName,
          phone: adminSetup.mobile,
          isPhoneVerified: true,
          email: adminEmail,
          emailVerifiedAt: new Date(),
          password: hashedPassword,
          isActive: true,
        },
        select: { id: true },
      });

      const org = await tx.organization.create({
        data: {
          id: orgId,
          slug: finalSlug,
          status: "ACTIVE",
          mode: organizationMode,
          onboardingStep: "COMPLETED",
          createdByUserId: user.id,
          organizationName: schoolInfo.schoolName,
          displayName: schoolInfo.schoolName,
          organizationCategory: "SCHOOL",
          organizationStructure: "SINGLE",
          city: schoolInfo.city,
          organizationMobile: schoolInfo.contactNumber,
          organizationPhone: schoolInfo.contactNumber,
        },
        select: { id: true, organizationName: true },
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

      const cityCode = await generateCityCode(schoolInfo.city, org.id, tx);
      const city = await tx.city.create({
        data: {
          name: schoolInfo.city,
          unitCode: cityCode,
          organizationId: org.id,
        },
      });

      const campusUnitCode = await generateUnitCode("CAMPUS", city.id, org.id, tx);
      const fullUnitPath = await buildFullUnitPath(city.id, null, campusUnitCode, tx);
      const campusCode = `${org.id}-${fullUnitPath}`;

      const campus = await tx.campus.create({
        data: {
          organizationId: org.id,
          name: `${schoolInfo.schoolName} Main Campus`,
          campusCode,
          campusSlug: campusCode.toLowerCase(),
          unitCode: campusUnitCode,
          fullUnitPath,
          cityId: city.id,
          isMainCampus: true,
          contactPhone: schoolInfo.contactNumber,
        },
      });

      await createUnitProfile({
        tx,
        organizationId: org.id,
        unitType: "CITY",
        unitId: city.id,
        displayName: city.name,
      });
      await createUnitProfile({
        tx,
        organizationId: org.id,
        unitType: "CAMPUS",
        unitId: String(campus.id),
        displayName: campus.name,
      });

      const year = await tx.academicYear.create({
        data: {
          organizationId: org.id,
          name: yearInfo.name,
          startDate: yearInfo.startDate,
          endDate: yearInfo.endDate,
          status: "ACTIVE",
          isActive: true,
        },
      });

      for (const classNo of academicSetup.classes) {
        const cls = await tx.class.create({
          data: {
            organizationId: org.id,
            academicYearId: year.id,
            campusId: campus.id,
            name: String(classNo),
            displayOrder: classNo,
            status: "ACTIVE",
          },
        });

        for (let i = 1; i <= academicSetup.sectionsPerClass; i += 1) {
          await tx.section.create({
            data: {
              organizationId: org.id,
              academicYearId: year.id,
              campusId: campus.id,
              classId: cls.id,
              name: String.fromCharCode(64 + i),
              status: "ACTIVE",
            },
          });
        }
      }

      const feeHead = await tx.feeHead.create({
        data: {
          organizationId: org.id,
          name: "Tuition Fee",
          type: "TUITION",
          isSystemDefault: true,
        },
      });

      await tx.feeStructure.create({
        data: {
          organizationId: org.id,
          campusId: campus.id,
          feeHeadId: feeHead.id,
          name: "Standard Monthly Fee",
          amount: feeSetup.averageMonthlyFee,
          frequency: "MONTHLY",
          isActive: true,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ORG_ADMIN",
          status: "ACTIVE",
          campusId: campus.id,
        },
      });

      await tx.onboardingProgress.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          currentStep: 5,
          stepsCompleted: ["school-info", "academic-setup", "fee-setup", "admin-create", "complete"],
          completed: true,
          metadata: {
            approxStudents: schoolInfo.approxStudents,
            quickSetup: true,
          },
        },
        update: {
          currentStep: 5,
          stepsCompleted: ["school-info", "academic-setup", "fee-setup", "admin-create", "complete"],
          completed: true,
        },
      });

      await tx.onboardingDraft.update({
        where: { token },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      return {
        organizationId: org.id,
        organizationName: org.organizationName,
        adminEmail,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
      redirectTo: "/admin/dashboard",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to complete onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
