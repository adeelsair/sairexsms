const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@sairex-sms.com";
const PASSWORD = "Admin@123";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("DATABASE_URL=")) continue;
    let value = trimmed.slice("DATABASE_URL=".length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env.DATABASE_URL = value;
    return;
  }
}

class CookieJar {
  constructor() { this.map = new Map(); }
  addFromResponse(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const [nv] = raw.split(";");
      const [name, ...vp] = nv.split("=");
      if (!name) continue;
      this.map.set(name.trim(), vp.join("=").trim());
    }
  }
  header() {
    return Array.from(this.map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function requestJson(pathname, { method = "GET", jar, body } = {}) {
  const headers = {};
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers.Cookie = cookie;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  jar?.addFromResponse(res);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

function decimalToNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.students)) return value.students;
  return [];
}

async function signIn() {
  const jar = new CookieJar();
  const csrf = await requestJson("/api/auth/csrf", { jar });
  const csrfToken = csrf.data?.csrfToken;
  if (!csrfToken) throw new Error("Failed to get CSRF");

  const signinRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD }).toString(),
    redirect: "manual",
  });
  jar.addFromResponse(signinRes);
  return jar;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  const debug = process.env.DEBUG_LEDGER_A === "1";

  try {
    const jar = await signIn();
    const session = await requestJson("/api/auth/session", { jar });
    const orgId = session.data?.user?.organizationId;
    if (!orgId) {
      if (debug) console.log("DEBUG", { step: "session", session });
      console.log("FAIL");
      return;
    }

    const challans = await prisma.feeChallan.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      select: {
        id: true,
        studentId: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
      },
      orderBy: { id: "desc" },
      take: 300,
    });

    const withRemaining = challans
      .map((c) => {
        const total = decimalToNumber(c.totalAmount);
        const paid = decimalToNumber(c.paidAmount ?? 0);
        const remaining = Number((total - paid).toFixed(2));
        return { ...c, total, paid, remaining };
      })
      .filter((c) => c.remaining > 0);

    const byStudent = new Map();
    for (const c of withRemaining) {
      if (!byStudent.has(c.studentId)) byStudent.set(c.studentId, []);
      byStudent.get(c.studentId).push(c);
    }

    // Prefer a student with exactly one outstanding challan and enough room for partial + full.
    let target = null;
    for (const [studentId, rows] of byStudent.entries()) {
      if (rows.length !== 1) continue;
      if (rows[0].remaining <= 1) continue;
      target = { studentId, challan: rows[0] };
      break;
    }
    if (!target) {
      // Controlled fixture path: create student + structure + challan so A1/A2 can be validated deterministically.
      const classesRes = await requestJson("/api/mobile/attendance/classes", { jar });
      const classes = listFrom(classesRes.data);
      const firstClass = classes[0];
      if (!firstClass?.campusId || !firstClass?.className) {
        if (debug) console.log("DEBUG", { step: "fixture-class", classesRes });
        console.log("FAIL");
        return;
      }

      const fixtureStudent = await requestJson("/api/students", {
        method: "POST",
        jar,
        body: {
          fullName: `Ledger Fixture ${Date.now()}`,
          admissionNo: `LF-${Date.now()}`,
          grade: firstClass.className,
          campusId: firstClass.campusId,
        },
      });
      const fixtureStudentId = fixtureStudent.data?.id;
      if (!fixtureStudentId) {
        if (debug) console.log("DEBUG", { step: "fixture-student", fixtureStudent });
        console.log("FAIL");
        return;
      }

      const feeHead = await requestJson("/api/finance/heads", {
        method: "POST",
        jar,
        body: {
          name: `Ledger Head ${Date.now()}`,
          type: "RECURRING",
        },
      });
      const feeHeadId = feeHead.data?.id;
      if (!feeHeadId) {
        if (debug) console.log("DEBUG", { step: "fixture-fee-head", feeHead });
        console.log("FAIL");
        return;
      }

      const feeStructure = await requestJson("/api/finance/structures", {
        method: "POST",
        jar,
        body: {
          name: `Ledger Structure ${Date.now()}`,
          amount: "1000",
          frequency: "MONTHLY",
          applicableGrade: firstClass.className,
          campusId: firstClass.campusId,
          feeHeadId,
        },
      });
      if (feeStructure.status < 200 || feeStructure.status >= 300) {
        if (debug) console.log("DEBUG", { step: "fixture-structure", feeStructure });
        console.log("FAIL");
        return;
      }

      const billingToken = `LA-${Date.now()}`;
      const generated = await requestJson("/api/finance/challans", {
        method: "POST",
        jar,
        body: {
          campusId: firstClass.campusId,
          targetGrade: firstClass.className,
          billingMonth: billingToken,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      if (generated.status < 200 || generated.status >= 300) {
        if (debug) console.log("DEBUG", { step: "fixture-challan-generate", generated });
        console.log("FAIL");
        return;
      }

      const fixtureChallan = await prisma.feeChallan.findFirst({
        where: {
          organizationId: orgId,
          studentId: fixtureStudentId,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        orderBy: { id: "desc" },
        select: {
          id: true,
          studentId: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
        },
      });
      if (!fixtureChallan) {
        if (debug) console.log("DEBUG", { step: "fixture-challan-missing", fixtureStudentId });
        console.log("FAIL");
        return;
      }

      const total = decimalToNumber(fixtureChallan.totalAmount);
      const paid = decimalToNumber(fixtureChallan.paidAmount ?? 0);
      const remaining = Number((total - paid).toFixed(2));
      target = { studentId: fixtureStudentId, challan: { ...fixtureChallan, total, paid, remaining } };
    }

    const studentId = target.studentId;
    const challanId = target.challan.id;

    const summaryBefore = await prisma.studentFinancialSummary.findUnique({
      where: { studentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const ledgerCountBefore = await prisma.ledgerEntry.count({
      where: { organizationId: orgId, studentId },
    });

    const partialAmount = Number(Math.min(1, target.challan.remaining - 0.01).toFixed(2));
    const partialRes = await requestJson("/api/finance/payments", {
      method: "POST",
      jar,
      body: {
        challanId,
        amount: partialAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: "OTC",
        referenceNumber: `A1-${Date.now()}`,
      },
    });
    if (partialRes.status !== 201) {
      if (debug) console.log("DEBUG", { step: "partial-payment", partialRes, challanId, partialAmount });
      console.log("FAIL");
      return;
    }

    const challanAfterPartial = await prisma.feeChallan.findUnique({
      where: { id: challanId },
      select: { totalAmount: true, paidAmount: true, status: true },
    });
    const remainingAfterPartial = Number(
      (
        decimalToNumber(challanAfterPartial.totalAmount) -
        decimalToNumber(challanAfterPartial.paidAmount ?? 0)
      ).toFixed(2),
    );

    const summaryAfterPartial = await prisma.studentFinancialSummary.findUnique({
      where: { studentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const ledgerRowsAfterPartial = await prisma.ledgerEntry.findMany({
      where: { organizationId: orgId, studentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, direction: true, amount: true, challanId: true, createdAt: true },
    });
    const ledgerCountAfterPartial = await prisma.ledgerEntry.count({
      where: { organizationId: orgId, studentId },
    });

    const a1SingleNewLedger = ledgerCountAfterPartial === ledgerCountBefore + 1;
    const a1HasCreditEntry = ledgerRowsAfterPartial.some(
      (r) => r.challanId === challanId && r.direction === "CREDIT" && Number(r.amount) === partialAmount,
    );
    const a1SummaryMath = summaryAfterPartial
      ? Number(
          (
            decimalToNumber(summaryAfterPartial.totalDebit) -
            decimalToNumber(summaryAfterPartial.totalCredit)
          ).toFixed(2),
        ) === Number(decimalToNumber(summaryAfterPartial.balance).toFixed(2))
      : false;
    const a1RemainingReduced = remainingAfterPartial < target.challan.remaining;

    if (!(a1SingleNewLedger && a1HasCreditEntry && a1SummaryMath && a1RemainingReduced)) {
      if (debug) {
        console.log("DEBUG", {
          step: "A1-check",
          a1SingleNewLedger,
          a1HasCreditEntry,
          a1SummaryMath,
          a1RemainingReduced,
          ledgerCountBefore,
          ledgerCountAfterPartial,
          ledgerRowsAfterPartial,
          targetRemaining: target.challan.remaining,
          remainingAfterPartial,
          summaryBefore,
          summaryAfterPartial,
        });
      }
      console.log("FAIL");
      return;
    }

    // A2: full payment of remaining balance
    const fullAmount = remainingAfterPartial;
    if (!(fullAmount > 0)) {
      if (debug) console.log("DEBUG", { step: "full-amount", fullAmount });
      console.log("FAIL");
      return;
    }

    const fullRes = await requestJson("/api/finance/payments", {
      method: "POST",
      jar,
      body: {
        challanId,
        amount: fullAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: "OTC",
        referenceNumber: `A2-${Date.now()}`,
      },
    });
    if (fullRes.status !== 201) {
      if (debug) console.log("DEBUG", { step: "full-payment", fullRes, challanId, fullAmount });
      console.log("FAIL");
      return;
    }

    const challanAfterFull = await prisma.feeChallan.findUnique({
      where: { id: challanId },
      select: { totalAmount: true, paidAmount: true, status: true },
    });
    const finalRemaining = Number(
      (
        decimalToNumber(challanAfterFull.totalAmount) -
        decimalToNumber(challanAfterFull.paidAmount ?? 0)
      ).toFixed(2),
    );
    const summaryAfterFull = await prisma.studentFinancialSummary.findUnique({
      where: { studentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const overallOutstandingForStudent = await prisma.feeChallan.findMany({
      where: {
        organizationId: orgId,
        studentId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      select: { totalAmount: true, paidAmount: true },
    });
    const outstandingBalance = Number(
      overallOutstandingForStudent
        .reduce((sum, row) => {
          return sum + (decimalToNumber(row.totalAmount) - decimalToNumber(row.paidAmount ?? 0));
        }, 0)
        .toFixed(2),
    );
    const a2SummaryMath = summaryAfterFull
      ? Number(
          (
            decimalToNumber(summaryAfterFull.totalDebit) -
            decimalToNumber(summaryAfterFull.totalCredit)
          ).toFixed(2),
        ) === Number(decimalToNumber(summaryAfterFull.balance).toFixed(2))
      : false;

    const a2Pass =
      finalRemaining === 0 &&
      challanAfterFull.status === "PAID" &&
      outstandingBalance === 0 &&
      Number(decimalToNumber(summaryAfterFull.balance).toFixed(2)) >= 0 &&
      a2SummaryMath;

    if (!a2Pass && debug) {
      console.log("DEBUG", {
        step: "A2-check",
        finalRemaining,
        challanStatus: challanAfterFull.status,
        outstandingBalance,
        summaryAfterFull,
        a2SummaryMath,
      });
    }
    console.log(a2Pass ? "PASS" : "FAIL");
  } catch {
    if (debug) console.log("DEBUG", { step: "exception" });
    console.log("FAIL");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
