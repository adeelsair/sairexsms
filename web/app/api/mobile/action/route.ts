import { NextResponse } from "next/server";
import { z } from "zod";

import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import { AttendanceError, bulkMarkAttendance } from "@/lib/academic/attendance.service";
import {
  listOutstandingChallansByStudent,
  PaymentEntryError,
  reconcilePayment,
} from "@/lib/finance/payment-entry.service";
import { prisma } from "@/lib/prisma";
import {
  incrementDailyChallanCount,
  incrementDailyStudentCount,
} from "@/lib/performance/organization-daily-stats.service";

const collectFeePayloadSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  challanId: z.coerce.number().int().positive().optional(),
});

const markAttendancePayloadSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  date: z.string().min(1),
  absentees: z.array(z.coerce.number().int().positive()),
});

const mobileActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("COLLECT_FEE"),
    payload: collectFeePayloadSchema,
  }),
  z.object({
    type: z.literal("MARK_ATTENDANCE"),
    payload: markAttendancePayloadSchema,
  }),
  z.object({
    type: z.literal("ADD_STUDENT_QUICK"),
    payload: z.object({
      studentName: z.string().min(1),
      fatherName: z.string().min(1),
      mobileNumber: z.string().min(7),
      classId: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("ISSUE_CHALLAN"),
    payload: z.object({
      mode: z.enum(["single", "class"]),
      studentId: z.coerce.number().int().positive().optional(),
      classId: z.string().min(1).optional(),
      month: z.coerce.number().int().min(1).max(12),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
    }),
  }),
]);

function chooseTargetChallan(input: {
  challans: Array<{
    id: number;
    dueDate: Date;
    balance: number;
  }>;
  amount: number;
  requestedChallanId?: number;
}) {
  if (input.requestedChallanId) {
    const requested = input.challans.find(
      (challan) => challan.id === input.requestedChallanId,
    );
    if (!requested) {
      throw new PaymentEntryError("Requested challan is not available");
    }
    if (input.amount > requested.balance) {
      throw new PaymentEntryError(
        "Amount exceeds selected challan balance",
      );
    }
    return requested;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthCandidate = input.challans.find((challan) => {
    const dueDate = new Date(challan.dueDate);
    return (
      dueDate.getMonth() === currentMonth &&
      dueDate.getFullYear() === currentYear &&
      challan.balance >= input.amount
    );
  });
  if (currentMonthCandidate) {
    return currentMonthCandidate;
  }

  const firstFitting = input.challans.find(
    (challan) => challan.balance >= input.amount,
  );
  if (firstFitting) {
    return firstFitting;
  }

  throw new PaymentEntryError(
    "Amount exceeds available challan balance. Split payment is not supported yet.",
  );
}

function buildMobileChallanNo(
  campusId: number,
  studentId: number,
  month: number,
  year: number,
) {
  return `MCH-${campusId}-${studentId}-${String(month).padStart(2, "0")}${year}-${Date.now().toString().slice(-5)}`;
}

function buildDueDate(month: number, year: number): Date {
  return new Date(Date.UTC(year, month - 1, 10));
}

async function createMobileChallanWithPosting(input: {
  organizationId: string;
  campusId: number;
  studentId: number;
  challanNo: string;
  dueDate: Date;
  totalAmount: number;
  generatedBy: string;
  month: number;
  year: number;
}) {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.feeChallan.create({
      data: {
        organizationId: input.organizationId,
        campusId: input.campusId,
        studentId: input.studentId,
        challanNo: input.challanNo,
        dueDate: input.dueDate,
        totalAmount: input.totalAmount,
        generatedBy: input.generatedBy,
        month: input.month,
        year: input.year,
      },
      select: {
        id: true,
        student: { select: { fullName: true } },
        totalAmount: true,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        organizationId: input.organizationId,
        studentId: input.studentId,
        campusId: input.campusId,
        challanId: challan.id,
        entryType: "CHALLAN_CREATED",
        direction: "DEBIT",
        amount: input.totalAmount,
        referenceId: String(challan.id),
        referenceType: "FeeChallan",
      },
    });

    await tx.studentFinancialSummary.upsert({
      where: { studentId: input.studentId },
      create: {
        studentId: input.studentId,
        organizationId: input.organizationId,
        campusId: input.campusId,
        totalDebit: input.totalAmount,
        totalCredit: 0,
        balance: input.totalAmount,
      },
      update: {
        totalDebit: { increment: input.totalAmount },
        balance: { increment: input.totalAmount },
      },
    });
    await incrementDailyChallanCount(tx, {
      organizationId: input.organizationId,
      outstandingAmount: input.totalAmount,
    });

    return challan;
  });
}

async function computeMonthlyFeeForStudent(input: {
  organizationId: string;
  campusId: number;
  grade: string;
  month: number;
}) {
  const structures = await prisma.feeStructure.findMany({
    where: {
      organizationId: input.organizationId,
      campusId: input.campusId,
      frequency: "MONTHLY",
      isActive: true,
      OR: [
        { applicableGrade: input.grade },
        { applicableGrade: null },
        { applicableGrade: "" },
      ],
    },
    select: {
      amount: true,
      startMonth: true,
      endMonth: true,
    },
  });

  const activeStructures = structures.filter((item) => {
    if (item.startMonth != null && input.month < item.startMonth) return false;
    if (item.endMonth != null && input.month > item.endMonth) return false;
    return true;
  });

  return activeStructures.reduce((sum, item) => sum + Number(item.amount), 0);
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const body = await request.json();
    const parsed = mobileActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid action payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const action = parsed.data;
    const organizationId = guard.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    if (action.type === "MARK_ATTENDANCE") {
      const attendanceRoleCheck = requireRole(
        guard,
        "SUPER_ADMIN",
        "ORG_ADMIN",
        "CAMPUS_ADMIN",
        "TEACHER",
      );
      if (attendanceRoleCheck) {
        return attendanceRoleCheck;
      }

      const section = await prisma.section.findUnique({
        where: { id: action.payload.sectionId },
        select: {
          id: true,
          classId: true,
          campusId: true,
          academicYearId: true,
          organizationId: true,
          classTeacherId: true,
        },
      });

      if (!section || section.organizationId !== organizationId) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
      if (section.classId !== action.payload.classId) {
        return NextResponse.json(
          { error: "Class and section mismatch" },
          { status: 400 },
        );
      }
      if (guard.campusId && section.campusId !== guard.campusId) {
        return NextResponse.json(
          { error: "Section is outside your campus scope" },
          { status: 403 },
        );
      }
      const isTeacher = guard.role === "TEACHER" && !isSuperAdmin(guard);
      if (isTeacher && section.classTeacherId !== guard.membershipId) {
        return NextResponse.json(
          { error: "You are not assigned to this class section" },
          { status: 403 },
        );
      }

      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          organizationId,
          sectionId: section.id,
          status: "ACTIVE",
        },
        select: {
          id: true,
          studentId: true,
        },
      });

      if (!enrollments.length) {
        return NextResponse.json(
          { error: "No active students found in this section" },
          { status: 400 },
        );
      }

      const absentees = new Set(action.payload.absentees);
      const entries = enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        status: absentees.has(enrollment.studentId)
          ? ("ABSENT" as const)
          : ("PRESENT" as const),
      }));

      const attendanceDate = new Date(action.payload.date);
      if (Number.isNaN(attendanceDate.getTime())) {
        return NextResponse.json({ error: "Invalid attendance date" }, { status: 400 });
      }

      const result = await bulkMarkAttendance({
        organizationId,
        academicYearId: section.academicYearId,
        campusId: section.campusId,
        classId: section.classId,
        sectionId: section.id,
        date: attendanceDate,
        markedById: guard.membershipId ?? undefined,
        entries,
      });

      return NextResponse.json({
        type: action.type,
        queued: false,
        posted: true,
        result: {
          ...result,
          classId: section.classId,
          sectionId: section.id,
          presentCount: enrollments.length - absentees.size,
          absentCount: absentees.size,
        },
      });
    }

    if (action.type === "ADD_STUDENT_QUICK") {
      const admissionRoleCheck = requireRole(
        guard,
        "SUPER_ADMIN",
        "ORG_ADMIN",
        "CAMPUS_ADMIN",
      );
      if (admissionRoleCheck) {
        return admissionRoleCheck;
      }

      const cls = await prisma.class.findUnique({
        where: { id: action.payload.classId },
        select: {
          id: true,
          name: true,
          organizationId: true,
          campusId: true,
          academicYearId: true,
          status: true,
        },
      });
      if (!cls || cls.organizationId !== organizationId) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }
      if (cls.status !== "ACTIVE") {
        return NextResponse.json({ error: "Class is not active" }, { status: 400 });
      }
      if (guard.campusId && cls.campusId !== guard.campusId) {
        return NextResponse.json(
          { error: "Class is outside your campus scope" },
          { status: 403 },
        );
      }

      const activeYear = await prisma.academicYear.findFirst({
        where: {
          organizationId,
          status: "ACTIVE",
          id: cls.academicYearId,
        },
        select: { id: true },
      });
      if (!activeYear) {
        return NextResponse.json(
          { error: "Class is not in active academic year" },
          { status: 400 },
        );
      }

      const normalizedMobile = action.payload.mobileNumber.replace(/\D/g, "");

      const result = await prisma.$transaction(async (tx) => {
        const sequence = await tx.job.count({
          where: { type: "QUICK_ADMISSION_DRAFT", organizationId },
        });

        let admissionNo = `GR-${String(sequence + 10001)}`;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const exists = await tx.student.findUnique({
            where: { admissionNo },
            select: { id: true },
          });
          if (!exists) {
            break;
          }
          admissionNo = `GR-${Date.now().toString().slice(-6)}${attempt + 1}`;
        }

        const student = await tx.student.create({
          data: {
            fullName: action.payload.studentName,
            admissionNo,
            grade: cls.name,
            organizationId,
            campusId: cls.campusId,
            feeStatus: "Unpaid",
          },
          select: {
            id: true,
            admissionNo: true,
          },
        });
        await incrementDailyStudentCount(tx, { organizationId });

        await tx.studentEnrollment.create({
          data: {
            organizationId,
            academicYearId: activeYear.id,
            studentId: student.id,
            campusId: cls.campusId,
            classId: cls.id,
          },
        });

        const draft = await tx.job.create({
          data: {
            type: "QUICK_ADMISSION_DRAFT",
            queue: "mobile",
            status: "PENDING",
            payload: {
              studentId: student.id,
              studentName: action.payload.studentName,
              fatherName: action.payload.fatherName,
              mobileNumber: normalizedMobile,
              classId: cls.id,
              admissionNo: student.admissionNo,
            },
            organizationId,
            referenceId: String(student.id),
          },
          select: { id: true },
        });

        return {
          studentId: student.id,
          grNumber: student.admissionNo,
          draftId: draft.id,
        };
      });

      return NextResponse.json({
        type: action.type,
        queued: false,
        posted: true,
        result,
      });
    }

    if (action.type === "ISSUE_CHALLAN") {
      const challanRoleCheck = requireRole(
        guard,
        "SUPER_ADMIN",
        "ORG_ADMIN",
        "CAMPUS_ADMIN",
        "ACCOUNTANT",
      );
      if (challanRoleCheck) {
        return challanRoleCheck;
      }

      const year = action.payload.year ?? new Date().getUTCFullYear();
      const month = action.payload.month;
      const dueDate = buildDueDate(month, year);

      if (action.payload.mode === "single") {
        if (!action.payload.studentId) {
          return NextResponse.json(
            { error: "studentId is required for single mode" },
            { status: 400 },
          );
        }

        const student = await prisma.student.findUnique({
          where: { id: action.payload.studentId },
          select: {
            id: true,
            organizationId: true,
            campusId: true,
            grade: true,
            fullName: true,
          },
        });
        if (!student || student.organizationId !== organizationId) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }
        if (guard.campusId && student.campusId !== guard.campusId) {
          return NextResponse.json(
            { error: "Student is outside your campus scope" },
            { status: 403 },
          );
        }

        const existing = await prisma.feeChallan.findFirst({
          where: {
            organizationId,
            studentId: student.id,
            month,
            year,
            status: { not: "CANCELLED" },
            feeStructureId: null,
          },
          select: { id: true },
        });
        if (existing) {
          return NextResponse.json({
            type: action.type,
            queued: false,
            posted: true,
            result: {
              generated: 0,
              skipped: 1,
              challanIds: [existing.id],
              totalAmount: 0,
            },
          });
        }

        const monthlyFee = await computeMonthlyFeeForStudent({
          organizationId,
          campusId: student.campusId,
          grade: student.grade,
          month,
        });
        if (monthlyFee <= 0) {
          return NextResponse.json(
            { error: "No active monthly fee structure found for student" },
            { status: 400 },
          );
        }

        const challan = await createMobileChallanWithPosting({
          organizationId,
          campusId: student.campusId,
          studentId: student.id,
          challanNo: buildMobileChallanNo(student.campusId, student.id, month, year),
          dueDate,
          totalAmount: monthlyFee,
          generatedBy: `MobileAction:${guard.id}`,
          month,
          year,
        });

        return NextResponse.json({
          type: action.type,
          queued: false,
          posted: true,
          result: {
            generated: 1,
            skipped: 0,
            challanIds: [challan.id],
            totalAmount: Number(challan.totalAmount),
            studentName: challan.student.fullName,
          },
        });
      }

      if (!action.payload.classId) {
        return NextResponse.json(
          { error: "classId is required for class mode" },
          { status: 400 },
        );
      }

      const cls = await prisma.class.findUnique({
        where: { id: action.payload.classId },
        select: {
          id: true,
          name: true,
          organizationId: true,
          campusId: true,
          status: true,
        },
      });
      if (!cls || cls.organizationId !== organizationId) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }
      if (guard.campusId && cls.campusId !== guard.campusId) {
        return NextResponse.json(
          { error: "Class is outside your campus scope" },
          { status: 403 },
        );
      }
      if (cls.status !== "ACTIVE") {
        return NextResponse.json({ error: "Class is not active" }, { status: 400 });
      }

      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          organizationId,
          classId: cls.id,
          campusId: cls.campusId,
          status: "ACTIVE",
        },
        select: {
          studentId: true,
          student: {
            select: {
              grade: true,
            },
          },
        },
      });

      if (!enrollments.length) {
        return NextResponse.json(
          { error: "No active students found in class" },
          { status: 400 },
        );
      }

      let generated = 0;
      let skipped = 0;
      let totalAmount = 0;
      const challanIds: number[] = [];

      for (const enrollment of enrollments) {
        const existing = await prisma.feeChallan.findFirst({
          where: {
            organizationId,
            studentId: enrollment.studentId,
            month,
            year,
            status: { not: "CANCELLED" },
            feeStructureId: null,
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const monthlyFee = await computeMonthlyFeeForStudent({
          organizationId,
          campusId: cls.campusId,
          grade: enrollment.student.grade,
          month,
        });
        if (monthlyFee <= 0) {
          skipped += 1;
          continue;
        }

        const challan = await createMobileChallanWithPosting({
          organizationId,
          campusId: cls.campusId,
          studentId: enrollment.studentId,
          challanNo: buildMobileChallanNo(
            cls.campusId,
            enrollment.studentId,
            month,
            year,
          ),
          dueDate,
          totalAmount: monthlyFee,
          generatedBy: `MobileAction:${guard.id}`,
          month,
          year,
        });

        generated += 1;
        totalAmount += monthlyFee;
        challanIds.push(challan.id);
      }

      return NextResponse.json({
        type: action.type,
        queued: false,
        posted: true,
        result: {
          classId: cls.id,
          className: cls.name,
          generated,
          skipped,
          challanIds,
          totalAmount,
        },
      });
    }

    const financeRoleCheck = requireRole(
      guard,
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "CAMPUS_ADMIN",
      "ACCOUNTANT",
    );
    if (financeRoleCheck) {
      return financeRoleCheck;
    }

    if (action.type !== "COLLECT_FEE") {
      return NextResponse.json({ error: "Unsupported action type" }, { status: 400 });
    }

    const scope = {
      organizationId,
      campusId: guard.campusId ?? undefined,
      unitPath: guard.unitPath,
    };

    const challans = await listOutstandingChallansByStudent(
      scope,
      action.payload.studentId,
    );
    if (!challans.length) {
      return NextResponse.json(
        { error: "No outstanding challans found for student" },
        { status: 400 },
      );
    }

    const targetChallan = chooseTargetChallan({
      challans: challans.map((row) => ({
        id: row.id,
        dueDate: row.dueDate,
        balance: row.balance,
      })),
      amount: action.payload.amount,
      requestedChallanId: action.payload.challanId,
    });

    const result = await reconcilePayment({
      organizationId,
      challanId: targetChallan.id,
      amount: action.payload.amount,
      paymentDate: new Date(),
      paymentChannel: "OTC",
    });

    const remainingChallans = await listOutstandingChallansByStudent(
      scope,
      action.payload.studentId,
    );
    const wasDefaulterCleared = remainingChallans.length === 0;
    const receiptNo = `RCPT-${result.paymentRecordId.slice(-8).toUpperCase()}`;

    return NextResponse.json({
      type: action.type,
      queued: false,
      posted: true,
      receiptNo,
      wasDefaulterCleared,
      result,
    });
  } catch (error: unknown) {
    if (error instanceof PaymentEntryError || error instanceof AttendanceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to execute mobile action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
