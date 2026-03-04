import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/auth/getRequestContext";
import { getDailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { prisma } from "@/lib/prisma";
import { getSimpleTerm, resolveOrganizationMode } from "@/lib/system/mode.service";

export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext(request);
    const snapshot = await getDailyOperationsSnapshot({
      organizationId: ctx.organizationId,
      campusId: ctx.campusId,
      role: ctx.role,
      userId: ctx.userId,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const campusId = ctx.campusId ? Number(ctx.campusId) : undefined;

    const [totalSections, markedSectionsTodayRows] = await Promise.all([
      prisma.section.count({
        where: {
          organizationId: ctx.organizationId,
          status: "ACTIVE",
          ...(campusId ? { campusId } : {}),
        },
      }),
      prisma.attendance.findMany({
        where: {
          organizationId: ctx.organizationId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          ...(campusId ? { campusId } : {}),
        },
        distinct: ["sectionId"],
        select: { sectionId: true },
      }),
    ]);
    const markedSectionsToday = markedSectionsTodayRows.length;
    const unmarkedClassesCount = Math.max(totalSections - markedSectionsToday, 0);
    const mode = await resolveOrganizationMode(ctx.organizationId);
    const simpleTermReceivables = getSimpleTerm("RECEIVABLES", mode.isSimple);
    const simpleTermDefaulter = getSimpleTerm("DEFAULTER_ANALYSIS", mode.isSimple);
    const simpleTermLedger = getSimpleTerm("LEDGER", mode.isSimple);
    const totalStudents = await prisma.student.count({
      where: {
        organizationId: ctx.organizationId,
        ...(campusId ? { campusId } : {}),
      },
    });

    return NextResponse.json({
      kpis: [
        {
          id: "TODAY_COLLECTION",
          label: "Today Collection",
          value: snapshot.kpis.feeCollectedToday,
        },
        {
          id: "DEFAULTERS_COUNT",
          label: mode.isSimple ? "Fee Reminder List" : "Defaulters",
          value: snapshot.alerts.feeDefaultersToday,
        },
        {
          id: "ATTENDANCE_MARKED_CLASSES",
          label: "Classes Marked",
          value: markedSectionsToday,
        },
        {
          id: "TOTAL_STUDENTS",
          label: "Total Students",
          value: totalStudents,
        },
        {
          id: "PENDING_RECEIVABLES",
          label: simpleTermReceivables,
          value: snapshot.financeToday.outstandingAmount,
        },
      ],
      todayFocus: [
        {
          id: "TODAY_COLLECTION",
          label: "Collected Today",
          value: snapshot.kpis.feeCollectedToday,
        },
        {
          id: "ATTENDANCE_MARKED_CLASSES",
          label: "Attendance Marked",
          value: markedSectionsToday,
        },
        {
          id: "NEW_ADMISSIONS_TODAY",
          label: "New Admissions Today",
          value: snapshot.kpis.newAdmissionsToday,
        },
        {
          id: "CHALLANS_ISSUED_TODAY",
          label: "Challans Issued Today",
          value: snapshot.financeToday.invoicesGenerated,
        },
      ],
      alerts: [
        {
          id: "FEE_DEFAULTERS_ALERT",
          label: mode.isSimple ? simpleTermDefaulter : "Fee overdue for students",
          count: snapshot.alerts.feeDefaultersToday,
          href: "/mobile/defaulters",
        },
        {
          id: "ATTENDANCE_NOT_MARKED_ALERT",
          label: "Attendance not marked",
          count: unmarkedClassesCount,
          href: "/mobile/attendance/mark",
        },
        {
          id: "CHALLAN_NOT_GENERATED_ALERT",
          label: mode.isSimple ? `${simpleTermLedger} updates pending` : "Challan generation pending",
          count:
            snapshot.tasks.find((task) => task.type === "CHALLAN_GENERATION")
              ?.count ?? 0,
          href: "/mobile/challan/create",
        },
      ],
      role: snapshot.role,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load mobile dashboard";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
