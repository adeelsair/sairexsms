import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { reconcilePayment } from "@/lib/finance/payment-entry.service";

interface Fixture {
  organizationId: string;
  campusId: number;
  cityId: string;
  orgCreatedByUserId: number;
  orgIdCreated: string;
  studentId: number;
  feeHeadId: number;
  feeStructureId: number;
  challanId: number;
  totalAmount: number;
}

async function ensureBaseScope() {
  const existingCampus = await prisma.campus.findFirst({
    select: { id: true, organizationId: true, cityId: true },
    orderBy: { id: "asc" },
  });

  if (existingCampus) {
    return {
      campusId: existingCampus.id,
      organizationId: existingCampus.organizationId,
      cityId: existingCampus.cityId,
      orgCreatedByUserId: 0,
      orgIdCreated: "",
      created: false,
    };
  }

  const token = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const user = await prisma.user.create({
    data: {
      email: `finance.test.${token}@example.com`,
      password: "test-hash",
      name: "Finance Tester",
      isActive: true,
      platformRole: "SUPER_ADMIN",
    },
    select: { id: true },
  });

  const orgId = `T${String(token).slice(-10)}`;
  const org = await prisma.organization.create({
    data: {
      id: orgId,
      slug: `finance-test-${token}`,
      createdByUserId: user.id,
      organizationName: `Finance Test Org ${token}`,
      displayName: `Finance Test Org ${token}`,
      organizationCategory: "SCHOOL",
      organizationStructure: "SINGLE",
    },
    select: { id: true },
  });

  const city = await prisma.city.create({
    data: {
      organizationId: org.id,
      name: `Finance Test City ${token}`,
      unitCode: `C${String(token).slice(-4)}`,
    },
    select: { id: true },
  });

  const campus = await prisma.campus.create({
    data: {
      organizationId: org.id,
      name: `Finance Test Campus ${token}`,
      campusCode: `C${String(token).slice(-6)}`,
      campusSlug: `cmp-${String(token).slice(-8)}`,
      unitCode: `U${String(token).slice(-4)}`,
      fullUnitPath: `CITY:${String(token).slice(-4)}>CMP:${String(token).slice(-4)}`,
      cityId: city.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return {
    campusId: campus.id,
    organizationId: org.id,
    cityId: city.id,
    orgCreatedByUserId: user.id,
    orgIdCreated: org.id,
    created: true,
  };
}

async function buildFixture(): Promise<Fixture> {
  const base = await ensureBaseScope();
  const campusId = base.campusId;
  const organizationId = base.organizationId;
  const token = `t${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const challanNo = `TST-${token}`;
  const totalAmount = 1000;

  const student = await prisma.student.create({
    data: {
      fullName: `Finance Test Student ${token}`,
      admissionNo: `ADM-${token}`,
      grade: "Grade 10",
      organizationId,
      campusId,
      feeStatus: "Unpaid",
    },
    select: { id: true },
  });

  const feeHead = await prisma.feeHead.create({
    data: {
      organizationId,
      name: `Test Fee Head ${token}`,
      type: "RECURRING",
    },
    select: { id: true },
  });

  const feeStructure = await prisma.feeStructure.create({
    data: {
      organizationId,
      campusId,
      feeHeadId: feeHead.id,
      name: `Test Structure ${token}`,
      amount: totalAmount,
      frequency: "MONTHLY",
      applicableGrade: "Grade 10",
      isActive: true,
    },
    select: { id: true },
  });

  const challan = await prisma.feeChallan.create({
    data: {
      organizationId,
      campusId,
      studentId: student.id,
      challanNo,
      dueDate: new Date(),
      totalAmount,
      paidAmount: 0,
      status: "UNPAID",
      generatedBy: "finance-test",
      feeStructureId: feeStructure.id,
    },
    select: { id: true },
  });

  await prisma.ledgerEntry.create({
    data: {
      organizationId,
      studentId: student.id,
      campusId,
      challanId: challan.id,
      entryType: "CHALLAN_CREATED",
      direction: "DEBIT",
      amount: totalAmount,
      referenceType: "Test",
      referenceId: randomUUID(),
    },
  });

  await prisma.studentFinancialSummary.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      organizationId,
      campusId,
      totalDebit: totalAmount,
      totalCredit: 0,
      balance: totalAmount,
    },
    update: {
      totalDebit: totalAmount,
      totalCredit: 0,
      balance: totalAmount,
    },
  });

  return {
    organizationId,
    campusId,
    cityId: base.cityId,
    orgCreatedByUserId: base.orgCreatedByUserId,
    orgIdCreated: base.orgIdCreated,
    studentId: student.id,
    feeHeadId: feeHead.id,
    feeStructureId: feeStructure.id,
    challanId: challan.id,
    totalAmount,
  };
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.ledgerEntry.deleteMany({ where: { challanId: fixture.challanId } });
  await prisma.paymentRecord.deleteMany({ where: { challanId: fixture.challanId } });
  await prisma.feeChallan.deleteMany({ where: { id: fixture.challanId } });
  await prisma.studentFinancialSummary.deleteMany({ where: { studentId: fixture.studentId } });
  await prisma.feeStructure.deleteMany({ where: { id: fixture.feeStructureId } });
  await prisma.feeHead.deleteMany({ where: { id: fixture.feeHeadId } });
  await prisma.student.deleteMany({ where: { id: fixture.studentId } });

  if (fixture.orgIdCreated) {
    await prisma.campus.deleteMany({ where: { organizationId: fixture.orgIdCreated } });
    await prisma.city.deleteMany({ where: { id: fixture.cityId } });
    await prisma.organization.deleteMany({ where: { id: fixture.orgIdCreated } });
    await prisma.user.deleteMany({ where: { id: fixture.orgCreatedByUserId } });
  }
}

const dbUrl = process.env.DATABASE_URL ?? "";
const hasUsableDbUrl =
  dbUrl.length > 0 &&
  (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) &&
  !dbUrl.includes("USER:PASSWORD") &&
  !dbUrl.includes("<") &&
  !dbUrl.includes("your_");

const describeIfDb = hasUsableDbUrl ? describe : describe.skip;

describeIfDb("finance reconciliation golden integration", () => {
  let fixture: Fixture | null = null;

  beforeEach(async () => {
    fixture = await buildFixture();
  });

  it("covers partial, full, and idempotency duplicate protection", async () => {
    const paymentDate = new Date("2026-02-24T00:00:00.000Z");

    const partial = await reconcilePayment({
      organizationId: fixture!.organizationId,
      challanId: fixture!.challanId,
      amount: 400,
      paymentDate,
      paymentChannel: "OTC",
      referenceNumber: "REF-1",
      notes: "partial payment",
    });

    const challanAfterPartial = await prisma.feeChallan.findUniqueOrThrow({
      where: { id: fixture!.challanId },
      select: { status: true, paidAmount: true },
    });

    expect(challanAfterPartial.status).toBe("PARTIALLY_PAID");
    expect(Number(challanAfterPartial.paidAmount)).toBe(400);

    const partialLedger = await prisma.ledgerEntry.findFirst({
      where: {
        organizationId: fixture!.organizationId,
        challanId: fixture!.challanId,
        entryType: "PAYMENT_RECEIVED",
        referenceId: partial.paymentRecordId,
      },
      select: { id: true, amount: true },
    });

    expect(partialLedger).not.toBeNull();
    expect(Number(partialLedger!.amount)).toBe(400);

    const summaryAfterPartial = await prisma.studentFinancialSummary.findUniqueOrThrow({
      where: { studentId: fixture.studentId },
      select: { balance: true, totalCredit: true },
    });

    expect(Number(summaryAfterPartial.balance)).toBe(600);
    expect(Number(summaryAfterPartial.totalCredit)).toBe(400);

    const ledgerCountBeforeDuplicate = await prisma.ledgerEntry.count({
      where: { challanId: fixture.challanId },
    });
    const balanceBeforeDuplicate = Number(summaryAfterPartial.balance);

    await expect(
      reconcilePayment({
        organizationId: fixture!.organizationId,
        challanId: fixture!.challanId,
        amount: 400,
        paymentDate,
        paymentChannel: "OTC",
        referenceNumber: "REF-1",
        notes: "partial payment",
      }),
    ).rejects.toThrow(/Duplicate payment submission detected/);

    const ledgerCountAfterDuplicate = await prisma.ledgerEntry.count({
      where: { challanId: fixture.challanId },
    });
    const summaryAfterDuplicate = await prisma.studentFinancialSummary.findUniqueOrThrow({
      where: { studentId: fixture.studentId },
      select: { balance: true },
    });

    expect(ledgerCountAfterDuplicate).toBe(ledgerCountBeforeDuplicate);
    expect(Number(summaryAfterDuplicate.balance)).toBe(balanceBeforeDuplicate);

    await reconcilePayment({
      organizationId: fixture.organizationId,
      challanId: fixture.challanId,
      amount: 600,
      paymentDate: new Date("2026-02-25T00:00:00.000Z"),
      paymentChannel: "BANK_TRANSFER",
      referenceNumber: "REF-2",
      notes: "final payment",
    });

    const challanAfterFull = await prisma.feeChallan.findUniqueOrThrow({
      where: { id: fixture!.challanId },
      select: { status: true, paidAmount: true },
    });

    expect(challanAfterFull.status).toBe("PAID");
    expect(Number(challanAfterFull.paidAmount)).toBe(fixture!.totalAmount);

    const ledgerTotals = await prisma.ledgerEntry.groupBy({
      by: ["direction"],
      where: { challanId: fixture!.challanId },
      _sum: { amount: true },
    });

    const debit = Number(
      ledgerTotals.find((row) => row.direction === "DEBIT")?._sum.amount ?? 0,
    );
    const credit = Number(
      ledgerTotals.find((row) => row.direction === "CREDIT")?._sum.amount ?? 0,
    );

    expect(debit).toBe(fixture!.totalAmount);
    expect(credit).toBe(fixture!.totalAmount);

    const summaryAfterFull = await prisma.studentFinancialSummary.findUniqueOrThrow({
      where: { studentId: fixture!.studentId },
      select: { balance: true, totalDebit: true, totalCredit: true },
    });

    expect(Number(summaryAfterFull.totalDebit)).toBe(fixture!.totalAmount);
    expect(Number(summaryAfterFull.totalCredit)).toBe(fixture!.totalAmount);
    expect(Number(summaryAfterFull.balance)).toBe(0);
  });

  afterEach(async () => {
    if (fixture) {
      await cleanupFixture(fixture);
      fixture = null;
    }
  });
});

