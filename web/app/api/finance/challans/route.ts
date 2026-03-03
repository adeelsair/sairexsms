import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import {
  scopeFilter,
  resolveOrgId,
  validateCrossRefs,
  assertOwnership,
} from "@/lib/tenant";
import {
  incrementDailyChallanCount,
  incrementDailyRevenue,
} from "@/lib/performance/organization-daily-stats.service";

// 1. GET: Fetch recent challans (tenant-scoped)
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const where = scopeFilter(guard, { hasCampus: true });

    const challans = await prisma.feeChallan.findMany({
      where,
      include: {
        student: true,
        campus: true,
      },
      orderBy: { issueDate: "desc" },
      take: 50,
    });
    return NextResponse.json(challans);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch challans" },
      { status: 500 }
    );
  }
}

// 2. POST: The Billing Engine — generate challans for a batch (tenant-scoped)
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;
  const audit = resolveAuditActor(guard);

  try {
    const body = await request.json();
    const { campusId, targetGrade, billingMonth, dueDate } = body;

    // Use session orgId (tenant boundary enforced)
    const orgId = resolveOrgId(guard);
    const parsedCampusId = parseInt(campusId);

    // Cross-reference validation: ensure campus belongs to the same org
    const crossRefError = await validateCrossRefs(orgId, [
      { model: "campus", id: parsedCampusId, label: "Campus" },
    ]);
    if (crossRefError) return crossRefError;

    // A. Find all active students in this Campus & Grade
    const students = await prisma.student.findMany({
      where: {
        organizationId: orgId,
        campusId: parsedCampusId,
        grade: targetGrade,
      },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No students found in this grade." },
        { status: 404 }
      );
    }

    // B. Find the Fee Rules for this Campus & Grade
    const rules = await prisma.feeStructure.findMany({
      where: {
        organizationId: orgId,
        campusId: parsedCampusId,
        isActive: true,
        OR: [
          { applicableGrade: targetGrade },
          { applicableGrade: null },
          { applicableGrade: "" },
        ],
      },
    });

    if (rules.length === 0) {
      return NextResponse.json(
        { error: "No fee rules found for this grade." },
        { status: 404 }
      );
    }

    // C. Calculate Total Amount
    let totalBillAmount = 0;
    rules.forEach((rule) => {
      totalBillAmount += Number(rule.amount);
    });

    // D. Generate Challans for Each Student
    let generatedCount = 0;
    const currentYear = new Date().getFullYear();

    for (const student of students) {
      const challanNo = `CH-${campusId}-${student.id}-${billingMonth.substring(0, 3).toUpperCase()}${currentYear}`;

      // Prevent double billing
      const existing = await prisma.feeChallan.findUnique({
        where: { challanNo },
      });

      if (!existing) {
        await prisma.$transaction(async (tx) => {
          const created = await tx.feeChallan.create({
            data: {
              organizationId: orgId,
              campusId: parsedCampusId,
              studentId: student.id,
              challanNo,
              dueDate: new Date(dueDate),
              totalAmount: totalBillAmount,
              status: "UNPAID",
              generatedBy: guard.email,
            },
          });

          await tx.ledgerEntry.create({
            data: {
              organizationId: orgId,
              studentId: student.id,
              campusId: parsedCampusId,
              challanId: created.id,
              entryType: "CHALLAN_CREATED",
              direction: "DEBIT",
              amount: totalBillAmount,
              referenceId: String(created.id),
              referenceType: "FeeChallan",
            },
          });

          await tx.studentFinancialSummary.upsert({
            where: { studentId: student.id },
            create: {
              studentId: student.id,
              organizationId: orgId,
              campusId: parsedCampusId,
              totalDebit: totalBillAmount,
              totalCredit: 0,
              balance: totalBillAmount,
            },
            update: {
              totalDebit: { increment: totalBillAmount },
              balance: { increment: totalBillAmount },
            },
          });
          await incrementDailyChallanCount(tx, {
            organizationId: orgId,
            outstandingAmount: totalBillAmount,
          });

          await tx.domainEventLog.create({
            data: {
              organizationId: orgId,
              eventType: "ChallanCreated",
              payload: {
                challanId: created.id,
                studentId: student.id,
                campusId: parsedCampusId,
                totalAmount: totalBillAmount,
                dueDate: new Date(dueDate).toISOString(),
                challanNo,
                _audit: {
                  actorUserId: audit.actorUserId,
                  effectiveUserId: audit.effectiveUserId,
                  tenantId: audit.tenantId,
                  impersonation: audit.impersonation,
                  impersonatedTenantId: audit.impersonation ? audit.tenantId : null,
                },
              },
              occurredAt: new Date(),
              initiatedByUserId: audit.actorUserId,
              processed: true,
            },
          });
        });
        generatedCount++;
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Generated ${generatedCount} challans successfully.`,
        studentsFound: students.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Billing Engine Error:", error);
    return NextResponse.json(
      { error: "Failed to generate challans" },
      { status: 500 }
    );
  }
}

// 3. PUT: Process Payment (tenant-scoped)
export async function PUT(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const { challanId, paymentMethod } = body;

    // Fetch the challan and verify it belongs to the user's org
    const challan = await prisma.feeChallan.findUnique({
      where: { id: parseInt(challanId) },
    });

    if (!challan) {
      return NextResponse.json(
        { error: "Challan not found" },
        { status: 404 }
      );
    }

    // Tenant boundary check (using centralized helper)
    const ownershipError = assertOwnership(guard, challan.organizationId);
    if (ownershipError) return ownershipError;

    if (challan.status === "PAID") {
      return NextResponse.json(
        { error: "Already paid" },
        { status: 400 }
      );
    }

    const receivedAmount = Math.max(
      Number(challan.totalAmount) - Number(challan.paidAmount),
      0,
    );
    const paidAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.feeChallan.update({
        where: { id: parseInt(challanId) },
        data: {
          status: "PAID",
          paidAmount: challan.totalAmount,
          paymentMethod,
          paidAt,
        },
      });
      if (receivedAmount > 0) {
        await incrementDailyRevenue(tx, {
          organizationId: challan.organizationId,
          amount: receivedAmount,
          date: paidAt,
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment recorded successfully",
    });
  } catch (error) {
    console.error("Payment Error:", error);
    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
