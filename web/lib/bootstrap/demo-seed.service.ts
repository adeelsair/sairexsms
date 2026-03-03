import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

interface DemoSeedOptions {
  isDemoMode?: boolean;
}

export interface DemoSeedResult {
  seeded: boolean;
  reason?: "already_seeded" | "has_academic_year";
  organizationId: string;
  academicYearId?: string;
  postingRunId?: string;
  classesCreated?: number;
  sectionsCreated?: number;
  studentsCreated?: number;
  challansCreated?: number;
}

const STUDENT_COUNT = 40;
const MONTHLY_TUITION = 5000;
const PAID_CHALLAN_COUNT = 5;

const CLASS_NAMES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
const SECTION_NAMES = ["A", "B"];

export async function bootstrapDemoDataIfEmpty(
  organizationId: string,
  options: DemoSeedOptions = {},
): Promise<DemoSeedResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      demoSeededAt: true,
      campuses: {
        where: { status: "ACTIVE" },
        select: { id: true },
        orderBy: [{ isMainCampus: "desc" }, { id: "asc" }],
        take: 1,
      },
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (org.demoSeededAt) {
    return {
      seeded: false,
      reason: "already_seeded",
      organizationId,
    };
  }

  const academicYearCount = await prisma.academicYear.count({
    where: { organizationId },
  });

  if (academicYearCount > 0 && !options.isDemoMode) {
    return {
      seeded: false,
      reason: "has_academic_year",
      organizationId,
    };
  }

  if (academicYearCount > 0) {
    return {
      seeded: false,
      reason: "has_academic_year",
      organizationId,
    };
  }

  const campus = org.campuses[0];
  if (!campus) {
    throw new Error("Organization has no active campus for demo seed");
  }

  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(currentMonth >= 8 ? currentYear : currentYear - 1, 7, 1));
  const yearEnd = new Date(Date.UTC(currentMonth >= 8 ? currentYear + 1 : currentYear, 5, 30));
  const academicYearName = `${yearStart.getUTCFullYear()}-${yearEnd.getUTCFullYear()}`;
  const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, 10));
  const attendanceDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.create({
      data: {
        organizationId,
        name: academicYearName,
        startDate: yearStart,
        endDate: yearEnd,
        status: "ACTIVE",
        isActive: true,
      },
      select: { id: true },
    });

    const createdClasses: Array<{ id: string; name: string; displayOrder: number }> = [];
    for (const [index, className] of CLASS_NAMES.entries()) {
      const cls = await tx.class.create({
        data: {
          organizationId,
          academicYearId: year.id,
          campusId: campus.id,
          name: className,
          code: `G${index + 1}`,
          displayOrder: index + 1,
          status: "ACTIVE",
        },
        select: { id: true, name: true, displayOrder: true },
      });
      createdClasses.push({
        id: cls.id,
        name: cls.name,
        displayOrder: cls.displayOrder ?? index + 1,
      });
    }

    const createdSections: Array<{ id: string; classId: string }> = [];
    for (const cls of createdClasses) {
      for (const sectionName of SECTION_NAMES) {
        const section = await tx.section.create({
          data: {
            organizationId,
            academicYearId: year.id,
            campusId: campus.id,
            classId: cls.id,
            name: sectionName,
            capacity: 40,
            status: "ACTIVE",
          },
          select: { id: true, classId: true },
        });
        createdSections.push(section);
      }
    }

    const sectionSlots = createdSections.map((section) => ({ ...section, count: 0 }));

    const students: Array<{ id: number }> = [];
    for (let i = 0; i < STUDENT_COUNT; i += 1) {
      const student = await tx.student.create({
        data: {
          organizationId,
          campusId: campus.id,
          fullName: `Student ${i + 1}`,
          admissionNo: `${organizationId}-D${String(i + 1).padStart(3, "0")}`,
          grade: CLASS_NAMES[i % CLASS_NAMES.length],
          feeStatus: "Unpaid",
        },
        select: { id: true },
      });
      students.push(student);
    }

    const enrollments: Prisma.StudentEnrollmentCreateManyInput[] = [];
    for (const [index, student] of students.entries()) {
      const slotIndex = index % sectionSlots.length;
      const slot = sectionSlots[slotIndex];
      slot.count += 1;

      const sectionNameIndex = slotIndex % SECTION_NAMES.length;
      const classNameIndex = Math.floor(slotIndex / SECTION_NAMES.length);
      const roll = `${classNameIndex + 1}${SECTION_NAMES[sectionNameIndex]}-${String(slot.count).padStart(2, "0")}`;

      enrollments.push({
        organizationId,
        studentId: student.id,
        academicYearId: year.id,
        campusId: campus.id,
        classId: slot.classId,
        sectionId: slot.id,
        rollNumber: roll,
        status: "ACTIVE",
      });
    }

    await tx.studentEnrollment.createMany({ data: enrollments });

    const feeHead = await tx.feeHead.create({
      data: {
        organizationId,
        name: "Tuition Fee",
        type: "TUITION",
        isSystemDefault: true,
      },
      select: { id: true },
    });

    const feeStructure = await tx.feeStructure.create({
      data: {
        organizationId,
        campusId: campus.id,
        feeHeadId: feeHead.id,
        name: "Standard Tuition Fee",
        amount: MONTHLY_TUITION,
        currency: "PKR",
        frequency: "MONTHLY",
        isActive: true,
      },
      select: { id: true },
    });

    const postingRun = await tx.postingRun.create({
      data: {
        organizationId,
        academicYearId: year.id,
        campusId: campus.id,
        month: currentMonth,
        year: currentYear,
        status: "COMPLETED",
        startedAt: now,
        completedAt: now,
        totalStudents: STUDENT_COUNT,
        totalChallans: STUDENT_COUNT,
        totalAmount: STUDENT_COUNT * MONTHLY_TUITION,
      },
      select: { id: true },
    });

    const challans: Array<{ id: number; studentId: number }> = [];
    for (const student of students) {
      const challan = await tx.feeChallan.create({
        data: {
          organizationId,
          campusId: campus.id,
          studentId: student.id,
          challanNo: `FP-${currentYear}${String(currentMonth).padStart(2, "0")}-${student.id}-${feeStructure.id}`,
          dueDate,
          totalAmount: MONTHLY_TUITION,
          status: "UNPAID",
          generatedBy: `DemoSeed:${postingRun.id}`,
          month: currentMonth,
          year: currentYear,
          feeStructureId: feeStructure.id,
          academicYearId: year.id,
        },
        select: { id: true, studentId: true },
      });
      challans.push(challan);
    }

    await tx.ledgerEntry.createMany({
      data: challans.map((challan) => ({
        organizationId,
        studentId: challan.studentId,
        campusId: campus.id,
        challanId: challan.id,
        entryType: "CHALLAN_CREATED",
        direction: "DEBIT",
        amount: MONTHLY_TUITION,
        academicYearId: year.id,
      })),
    });

    await tx.studentFinancialSummary.createMany({
      data: students.map((student) => ({
        studentId: student.id,
        organizationId,
        campusId: campus.id,
        totalDebit: MONTHLY_TUITION,
        totalCredit: 0,
        balance: MONTHLY_TUITION,
      })),
    });

    const paid = challans.slice(0, PAID_CHALLAN_COUNT);
    for (const challan of paid) {
      const payment = await tx.paymentRecord.create({
        data: {
          organizationId,
          challanId: challan.id,
          amount: MONTHLY_TUITION,
          currency: "PKR",
          paymentChannel: "OTC",
          gateway: "MANUAL",
          gatewayRef: `demo-${challan.id}`,
          paidAt: now,
          status: "RECONCILED",
        },
        select: { id: true },
      });

      await tx.feeChallan.update({
        where: { id: challan.id },
        data: {
          status: "PAID",
          paidAmount: MONTHLY_TUITION,
          paidAt: now,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          organizationId,
          studentId: challan.studentId,
          campusId: campus.id,
          challanId: challan.id,
          entryType: "PAYMENT_RECEIVED",
          direction: "CREDIT",
          amount: MONTHLY_TUITION,
          referenceId: payment.id,
          referenceType: "PaymentRecord",
          academicYearId: year.id,
        },
      });

      await tx.studentFinancialSummary.update({
        where: { studentId: challan.studentId },
        data: {
          totalCredit: { increment: MONTHLY_TUITION },
          balance: { decrement: MONTHLY_TUITION },
        },
      });
    }

    const persistedEnrollments = await tx.studentEnrollment.findMany({
      where: { organizationId, academicYearId: year.id },
      select: {
        id: true,
        studentId: true,
        campusId: true,
        classId: true,
        sectionId: true,
      },
      orderBy: [{ class: { displayOrder: "asc" } }, { rollNumber: "asc" }],
    });

    await tx.attendance.createMany({
      data: persistedEnrollments.map((enrollment, i) => {
        let status: "PRESENT" | "ABSENT" | "LEAVE" = "PRESENT";
        if (i >= 32 && i < 38) status = "ABSENT";
        if (i >= 38) status = "LEAVE";

        return {
          organizationId,
          academicYearId: year.id,
          campusId: enrollment.campusId,
          classId: enrollment.classId,
          sectionId: enrollment.sectionId!,
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          date: attendanceDate,
          status,
        };
      }),
    });

    await tx.organization.update({
      where: { id: organizationId },
      data: { demoSeededAt: now },
    });

    return {
      seeded: true,
      organizationId,
      academicYearId: year.id,
      postingRunId: postingRun.id,
      classesCreated: createdClasses.length,
      sectionsCreated: createdSections.length,
      studentsCreated: students.length,
      challansCreated: challans.length,
    };
  });
}

