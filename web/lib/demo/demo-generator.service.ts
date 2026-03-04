import { prisma } from "@/lib/prisma";
import { generateOrganizationId } from "@/lib/id-generators";
import { buildFullUnitPath, generateCityCode, generateUnitCode } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import { bootstrapDemoDataIfEmpty } from "@/lib/bootstrap/demo-seed.service";
import { getOrCreateDailyPrincipalBrief } from "@/lib/insights/principal-brief.service";
import { upsertDailyOperationalRiskSnapshot } from "@/lib/insights/operational-risk.service";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";

const DEMO_SCHOOL_NAME = "Al Noor Public School (Demo)";
const DEMO_CITY = "Lahore";
const TARGET_STUDENT_COUNT = 420;
const DEMO_FEE_AMOUNT = 5200;
const BATCH_SIZE = 1500;

type RiskProfile = "CLEAN" | "MODERATE" | "HIGH_FEE" | "ATTENDANCE_RISK" | "COMBINED" | "NORMAL";

export type DemoSchoolResult = {
  organizationId: string;
  organizationName: string;
  mode: "SIMPLE";
  isDemo: true;
  stats: {
    students: number;
    predictedDefaultersSeeded: number;
    attendanceRiskSeeded: number;
    combinedRiskSeeded: number;
  };
  demoRedirect: string;
};

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

function pickProfile(index: number, total: number): RiskProfile {
  const ratio = index / total;
  if (ratio < 0.4) return "CLEAN";
  if (ratio < 0.6) return "MODERATE";
  if (ratio < 0.7) return "HIGH_FEE";
  if (ratio < 0.8) return "ATTENDANCE_RISK";
  if (ratio < 0.85) return "COMBINED";
  return "NORMAL";
}

function withQuery(path: string, orgId: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}orgId=${encodeURIComponent(orgId)}`;
}

async function createDemoOrganization(createdByUserId: number) {
  const orgId = await generateOrganizationId();
  const slug = `demo-${Date.now()}-${randomSuffix()}`;
  const trialWindow = createTrialWindow();

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: orgId,
        slug,
        status: "ACTIVE",
        mode: "SIMPLE",
        isDemo: true,
        onboardingStep: "COMPLETED",
        createdByUserId,
        organizationName: DEMO_SCHOOL_NAME,
        displayName: DEMO_SCHOOL_NAME,
        organizationCategory: "SCHOOL",
        organizationStructure: "SINGLE",
        city: DEMO_CITY,
        organizationPhone: "03001234567",
        organizationMobile: "03001234567",
      },
      select: { id: true, organizationName: true },
    });

    await tx.organizationPlan.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        planType: "FREE",
        active: true,
        trialPlanType: TRIAL_POLICY.trialPlanType,
        trialStartedAt: trialWindow.trialStartedAt,
        trialEndsAt: trialWindow.trialEndsAt,
      },
      update: {},
    });

    const cityCode = await generateCityCode(DEMO_CITY, organization.id, tx);
    const city = await tx.city.create({
      data: {
        name: DEMO_CITY,
        unitCode: cityCode,
        organizationId: organization.id,
      },
      select: { id: true, name: true },
    });

    const campusUnitCode = await generateUnitCode("CAMPUS", city.id, organization.id, tx);
    const fullUnitPath = await buildFullUnitPath(city.id, null, campusUnitCode, tx);
    const campusCode = `${organization.id}-${fullUnitPath}`;
    const campus = await tx.campus.create({
      data: {
        organizationId: organization.id,
        name: `${DEMO_SCHOOL_NAME} Main Campus`,
        campusCode,
        campusSlug: campusCode.toLowerCase(),
        unitCode: campusUnitCode,
        fullUnitPath,
        cityId: city.id,
        isMainCampus: true,
        contactPhone: "03001234567",
      },
      select: { id: true },
    });

    await createUnitProfile({
      tx,
      organizationId: organization.id,
      unitType: "CITY",
      unitId: city.id,
      displayName: city.name,
    });
    await createUnitProfile({
      tx,
      organizationId: organization.id,
      unitType: "CAMPUS",
      unitId: String(campus.id),
      displayName: `${DEMO_SCHOOL_NAME} Main Campus`,
    });

    await tx.membership.create({
      data: {
        userId: createdByUserId,
        organizationId: organization.id,
        role: "ORG_ADMIN",
        status: "ACTIVE",
        campusId: campus.id,
      },
    });

    return {
      organizationId: organization.id,
      organizationName: organization.organizationName,
      campusId: campus.id,
    };
  });
}

async function createManyInBatches<T>(
  rows: T[],
  writer: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await writer(chunk);
  }
}

async function enrichDemoData(organizationId: string, campusId: number) {
  const now = new Date();
  const runTag = `DemoSales:${organizationId}:${Date.now()}`;

  const activeYear = await prisma.academicYear.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
  });
  if (!activeYear) {
    throw new Error("Demo academic year not found");
  }

  const sections = await prisma.section.findMany({
    where: {
      organizationId,
      academicYearId: activeYear.id,
      campusId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      classId: true,
      class: { select: { name: true } },
    },
    orderBy: [{ class: { displayOrder: "asc" } }, { name: "asc" }],
  });
  if (!sections.length) {
    throw new Error("Demo sections not found");
  }

  let feeStructure = await prisma.feeStructure.findFirst({
    where: { organizationId, campusId, isActive: true },
    select: { id: true },
  });
  if (!feeStructure) {
    const feeHead = await prisma.feeHead.create({
      data: {
        organizationId,
        name: "Tuition Fee",
        type: "TUITION",
        isSystemDefault: true,
      },
      select: { id: true },
    });
    feeStructure = await prisma.feeStructure.create({
      data: {
        organizationId,
        campusId,
        feeHeadId: feeHead.id,
        name: "Demo Monthly Tuition",
        amount: DEMO_FEE_AMOUNT,
        frequency: "MONTHLY",
        isActive: true,
      },
      select: { id: true },
    });
  }

  const existingStudents = await prisma.student.count({ where: { organizationId, campusId } });
  const additionalCount = Math.max(TARGET_STUDENT_COUNT - existingStudents, 0);

  const createdStudents: Array<{ id: number }> = [];
  for (let i = 0; i < additionalCount; i += 1) {
    const section = sections[i % sections.length];
    const student = await prisma.student.create({
      data: {
        organizationId,
        campusId,
        fullName: `Demo Student ${existingStudents + i + 1}`,
        admissionNo: `${organizationId}-S${String(existingStudents + i + 1).padStart(4, "0")}`,
        grade: section.class.name,
        feeStatus: "Unpaid",
      },
      select: { id: true },
    });
    createdStudents.push(student);
  }

  if (createdStudents.length) {
    await prisma.studentEnrollment.createMany({
      data: createdStudents.map((student, index) => {
        const section = sections[index % sections.length];
        return {
          organizationId,
          studentId: student.id,
          academicYearId: activeYear.id,
          campusId,
          classId: section.classId,
          sectionId: section.id,
          rollNumber: `D-${String(index + 1).padStart(3, "0")}`,
          status: "ACTIVE",
        };
      }),
    });
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      organizationId,
      academicYearId: activeYear.id,
      campusId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      sectionId: true,
    },
    orderBy: [{ class: { displayOrder: "asc" } }, { rollNumber: "asc" }],
  });

  const profileByStudent = new Map<number, RiskProfile>();
  for (const [index, enrollment] of enrollments.entries()) {
    profileByStudent.set(
      enrollment.studentId,
      pickProfile(index, enrollments.length),
    );
  }

  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const historicalMonths = [3, 2, 1].map((offset) => {
    const date = new Date(Date.UTC(currentYear, currentMonth - 1 - offset, 1));
    return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
  });

  const historicalRows: Array<{
    organizationId: string;
    campusId: number;
    studentId: number;
    challanNo: string;
    dueDate: Date;
    totalAmount: number;
    paidAmount: number;
    status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    generatedBy: string;
    month: number;
    year: number;
    feeStructureId: number;
    academicYearId: string;
    paidAt?: Date;
  }> = [];

  for (const enrollment of enrollments) {
    const profile = profileByStudent.get(enrollment.studentId) ?? "NORMAL";
    for (const [monthIndex, period] of historicalMonths.entries()) {
      const dueDate = new Date(Date.UTC(period.year, period.month - 1, 10));
      const totalAmount = DEMO_FEE_AMOUNT;
      let paidAmount = totalAmount;
      let status: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "PAID";
      let paidAt = new Date(dueDate);

      if (profile === "HIGH_FEE" || profile === "COMBINED") {
        paidAmount = Math.round(totalAmount * 0.45);
        status = "PARTIALLY_PAID";
        paidAt = new Date(Date.UTC(period.year, period.month - 1, 10 + 14 + monthIndex * 4));
      } else if (profile === "MODERATE") {
        paidAmount = totalAmount;
        status = "PAID";
        paidAt = new Date(Date.UTC(period.year, period.month - 1, 10 + (monthIndex === 2 ? 8 : 3)));
      } else if (profile === "NORMAL") {
        paidAmount = totalAmount;
        status = "PAID";
        paidAt = new Date(Date.UTC(period.year, period.month - 1, 10 + (monthIndex === 2 ? 2 : 0)));
      }

      historicalRows.push({
        organizationId,
        campusId,
        studentId: enrollment.studentId,
        challanNo: `${organizationId}-H-${period.year}${String(period.month).padStart(2, "0")}-${enrollment.studentId}`,
        dueDate,
        totalAmount,
        paidAmount,
        status,
        generatedBy: `${runTag}:hist`,
        month: period.month,
        year: period.year,
        feeStructureId: feeStructure.id,
        academicYearId: activeYear.id,
        paidAt,
      });
    }
  }

  await prisma.feeChallan.createMany({ data: historicalRows });

  const existingCurrentMonth = await prisma.feeChallan.findMany({
    where: {
      organizationId,
      month: currentMonth,
      year: currentYear,
      feeStructureId: feeStructure.id,
    },
    select: { studentId: true },
  });
  const currentExists = new Set(existingCurrentMonth.map((row) => row.studentId));
  const todayDue = new Date(Date.UTC(currentYear, now.getUTCMonth(), now.getUTCDate()));
  const todayRows = enrollments
    .filter((enrollment) => !currentExists.has(enrollment.studentId))
    .slice(0, 180)
    .map((enrollment) => ({
      organizationId,
      campusId,
      studentId: enrollment.studentId,
      challanNo: `${organizationId}-T-${currentYear}${String(currentMonth).padStart(2, "0")}-${enrollment.studentId}`,
      dueDate: todayDue,
      totalAmount: DEMO_FEE_AMOUNT,
      paidAmount: 0,
      status: "UNPAID" as const,
      generatedBy: `${runTag}:today`,
      month: currentMonth,
      year: currentYear,
      feeStructureId: feeStructure.id,
      academicYearId: activeYear.id,
    }));
  if (todayRows.length) {
    await prisma.feeChallan.createMany({ data: todayRows });
  }

  const createdChallans = await prisma.feeChallan.findMany({
    where: {
      organizationId,
      generatedBy: { in: [`${runTag}:hist`, `${runTag}:today`] },
    },
    select: {
      id: true,
      studentId: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      paidAt: true,
    },
  });

  if (createdChallans.length) {
    await prisma.ledgerEntry.createMany({
      data: createdChallans.map((row) => ({
        organizationId,
        studentId: row.studentId,
        campusId,
        challanId: row.id,
        entryType: "CHALLAN_CREATED" as const,
        direction: "DEBIT" as const,
        amount: Number(row.totalAmount),
        academicYearId: activeYear.id,
      })),
    });

    const paidRows = createdChallans.filter((row) => Number(row.paidAmount) > 0);
    if (paidRows.length) {
      await prisma.paymentRecord.createMany({
        data: paidRows.map((row) => ({
          organizationId,
          challanId: row.id,
          amount: Number(row.paidAmount),
          currency: "PKR",
          paymentChannel: "OTC",
          gateway: "MANUAL",
          gatewayRef: `demo-${row.id}-${Date.now()}`,
          paidAt: row.paidAt ?? now,
          status: "RECONCILED",
        })),
      });

      await prisma.ledgerEntry.createMany({
        data: paidRows.map((row) => ({
          organizationId,
          studentId: row.studentId,
          campusId,
          challanId: row.id,
          entryType: "PAYMENT_RECEIVED" as const,
          direction: "CREDIT" as const,
          amount: Number(row.paidAmount),
          academicYearId: activeYear.id,
        })),
      });
    }
  }

  const allChallans = await prisma.feeChallan.findMany({
    where: { organizationId },
    select: { studentId: true, totalAmount: true, paidAmount: true },
  });
  const summaryMap = new Map<number, { debit: number; credit: number }>();
  for (const row of allChallans) {
    const existing = summaryMap.get(row.studentId) ?? { debit: 0, credit: 0 };
    existing.debit += Number(row.totalAmount);
    existing.credit += Number(row.paidAmount);
    summaryMap.set(row.studentId, existing);
  }
  await prisma.studentFinancialSummary.deleteMany({ where: { organizationId } });
  await prisma.studentFinancialSummary.createMany({
    data: Array.from(summaryMap.entries()).map(([studentId, summary]) => ({
      studentId,
      organizationId,
      campusId,
      totalDebit: summary.debit,
      totalCredit: summary.credit,
      balance: Math.max(summary.debit - summary.credit, 0),
    })),
  });

  const attendanceRows: Array<{
    organizationId: string;
    academicYearId: string;
    campusId: number;
    classId: string;
    sectionId: string;
    enrollmentId: string;
    studentId: number;
    date: Date;
    status: "PRESENT" | "ABSENT" | "LATE";
  }> = [];

  for (const enrollment of enrollments) {
    const profile = profileByStudent.get(enrollment.studentId) ?? "NORMAL";
    for (let dayOffset = 30; dayOffset >= 1; dayOffset -= 1) {
      const date = new Date(Date.UTC(currentYear, now.getUTCMonth(), now.getUTCDate() - dayOffset));
      let status: "PRESENT" | "ABSENT" | "LATE" = "PRESENT";
      if (profile === "ATTENDANCE_RISK" || profile === "COMBINED") {
        if (dayOffset <= 4) {
          status = "ABSENT";
        } else if (dayOffset <= 10) {
          status = (enrollment.studentId + dayOffset) % 10 < 6 ? "ABSENT" : "PRESENT";
        } else if (dayOffset <= 20) {
          status = (enrollment.studentId + dayOffset) % 10 < 3 ? "ABSENT" : "PRESENT";
        } else {
          status = (enrollment.studentId + dayOffset) % 12 === 0 ? "LATE" : "PRESENT";
        }
      } else if (profile === "MODERATE") {
        status = (enrollment.studentId + dayOffset) % 20 === 0 ? "ABSENT" : "PRESENT";
      } else {
        status = (enrollment.studentId + dayOffset) % 25 === 0 ? "LATE" : "PRESENT";
      }

      attendanceRows.push({
        organizationId,
        academicYearId: activeYear.id,
        campusId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId ?? sections[0].id,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        date,
        status,
      });
    }
  }

  if (attendanceRows.length) {
    await createManyInBatches(attendanceRows, (chunk) =>
      prisma.attendance.createMany({ data: chunk }),
    );
  }

  const todayAbsentRows = enrollments
    .filter((enrollment) => {
      const profile = profileByStudent.get(enrollment.studentId) ?? "NORMAL";
      return profile === "ATTENDANCE_RISK" || profile === "COMBINED";
    })
    .slice(0, 60)
    .map((enrollment) => ({
      organizationId,
      academicYearId: activeYear.id,
      campusId,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId ?? sections[0].id,
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      date: todayDue,
      status: "ABSENT" as const,
    }));

  if (todayAbsentRows.length) {
    await prisma.attendance.createMany({ data: todayAbsentRows, skipDuplicates: true });
  }

  const highRiskStudentIds = enrollments
    .filter((enrollment) => {
      const profile = profileByStudent.get(enrollment.studentId) ?? "NORMAL";
      return profile === "HIGH_FEE" || profile === "COMBINED";
    })
    .slice(0, 30)
    .map((enrollment) => enrollment.studentId);

  const reminderTargetChallans = await prisma.feeChallan.findMany({
    where: {
      organizationId,
      studentId: { in: highRiskStudentIds },
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    select: { id: true, studentId: true },
    take: 100,
  });

  const reminderRows = reminderTargetChallans.flatMap((challan, index) => {
    const seedDate = new Date(now);
    seedDate.setUTCDate(seedDate.getUTCDate() - (index % 10));
    return [
      {
        organizationId,
        studentId: challan.studentId,
        challanId: challan.id,
        reminderRuleId: `demo-rule-${organizationId}`,
        channel: "SMS" as const,
        triggerType: "AFTER_DUE" as const,
        sentAt: seedDate,
        status: "FAILED" as const,
        messageBody: "Demo reminder",
      },
      {
        organizationId,
        studentId: challan.studentId,
        challanId: challan.id,
        reminderRuleId: `demo-rule-${organizationId}`,
        channel: "SMS" as const,
        triggerType: "FINAL_NOTICE" as const,
        sentAt: seedDate,
        status: "FAILED" as const,
        messageBody: "Demo final reminder",
      },
    ];
  });

  if (reminderRows.length) {
    const existingRule = await prisma.reminderRule.findFirst({
      where: { organizationId, name: "Demo Reminder Rule" },
      select: { id: true },
    });
    const reminderRuleId = existingRule
      ? existingRule.id
      : (
          await prisma.reminderRule.create({
            data: {
              organizationId,
              campusId,
              name: "Demo Reminder Rule",
              triggerType: "AFTER_DUE",
              minDaysOverdue: 1,
              channel: "SMS",
              template: "Demo reminder",
            },
            select: { id: true },
          })
        ).id;

    await prisma.reminderLog.createMany({
      data: reminderRows.map((row) => ({
        ...row,
        reminderRuleId,
      })),
    });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      demoSeededAt: now,
      mode: "SIMPLE",
      isDemo: true,
    },
  });

  const highFeeCount = enrollments.filter((entry) => {
    const profile = profileByStudent.get(entry.studentId);
    return profile === "HIGH_FEE";
  }).length;
  const attendanceRiskCount = enrollments.filter((entry) => {
    const profile = profileByStudent.get(entry.studentId);
    return profile === "ATTENDANCE_RISK";
  }).length;
  const combinedRiskCount = enrollments.filter((entry) => {
    const profile = profileByStudent.get(entry.studentId);
    return profile === "COMBINED";
  }).length;

  return {
    students: enrollments.length,
    predictedDefaultersSeeded: highFeeCount + combinedRiskCount,
    attendanceRiskSeeded: attendanceRiskCount,
    combinedRiskSeeded: combinedRiskCount,
  };
}

export async function generateDemoSchool(createdByUserId: number): Promise<DemoSchoolResult> {
  const org = await createDemoOrganization(createdByUserId);
  await bootstrapDemoDataIfEmpty(org.organizationId, { isDemoMode: true });
  const stats = await enrichDemoData(org.organizationId, org.campusId);
  await upsertDailyOperationalRiskSnapshot(org.organizationId);
  await getOrCreateDailyPrincipalBrief(org.organizationId);

  return {
    organizationId: org.organizationId,
    organizationName: org.organizationName,
    mode: "SIMPLE",
    isDemo: true,
    stats,
    demoRedirect: withQuery("/mobile/dashboard", org.organizationId),
  };
}

export async function resetDemoSchool(
  createdByUserId: number,
  organizationId?: string,
): Promise<DemoSchoolResult> {
  const target = organizationId
    ? await prisma.organization.findFirst({
        where: { id: organizationId, isDemo: true },
        select: { id: true },
      })
    : await prisma.organization.findFirst({
        where: { isDemo: true, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  if (target) {
    await prisma.organization.update({
      where: { id: target.id },
      data: { status: "ARCHIVED" },
    });
  }

  return generateDemoSchool(createdByUserId);
}
