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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env.DATABASE_URL = value;
    return;
  }
}

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  addFromResponse(response) {
    const cookies = response.headers.getSetCookie?.() ?? [];
    for (const raw of cookies) {
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
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function signIn() {
  const jar = new CookieJar();
  const csrf = await requestJson("/api/auth/csrf", { jar });
  const csrfToken = csrf.data?.csrfToken;
  if (!csrfToken) throw new Error("Missing csrf token");
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD }).toString(),
    redirect: "manual",
  });
  jar.addFromResponse(res);
  return jar;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const jar = await signIn();
    const session = await requestJson("/api/auth/session", { jar });
    const organizationId = session.data?.user?.organizationId;
    if (!organizationId) {
      console.log("FAIL");
      return;
    }

    const classesRes = await requestJson("/api/mobile/attendance/classes", { jar });
    const classes = listFrom(classesRes.data);
    const cls = classes[0];
    if (!cls?.campusId || !cls?.className) {
      console.log("FAIL");
      return;
    }

    const studentRes = await requestJson("/api/students", {
      method: "POST",
      jar,
      body: {
        fullName: `Atomicity Test ${Date.now()}`,
        admissionNo: `AT-${Date.now()}`,
        grade: cls.className,
        campusId: cls.campusId,
      },
    });
    const studentId = studentRes.data?.id;
    if (!studentId) {
      console.log("FAIL");
      return;
    }

    const headRes = await requestJson("/api/finance/heads", {
      method: "POST",
      jar,
      body: { name: `Atomicity Head ${Date.now()}`, type: "RECURRING" },
    });
    const feeHeadId = headRes.data?.id;
    if (!feeHeadId) {
      console.log("FAIL");
      return;
    }

    const structureRes = await requestJson("/api/finance/structures", {
      method: "POST",
      jar,
      body: {
        name: `Atomicity Structure ${Date.now()}`,
        amount: "1000",
        frequency: "MONTHLY",
        applicableGrade: cls.className,
        campusId: cls.campusId,
        feeHeadId,
      },
    });
    if (structureRes.status < 200 || structureRes.status >= 300) {
      console.log("FAIL");
      return;
    }

    const challanRes = await requestJson("/api/finance/challans", {
      method: "POST",
      jar,
      body: {
        campusId: cls.campusId,
        targetGrade: cls.className,
        billingMonth: `AT${Date.now().toString(36).toUpperCase()}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    if (challanRes.status < 200 || challanRes.status >= 300) {
      console.log("FAIL");
      return;
    }

    const challan = await prisma.feeChallan.findFirst({
      where: { organizationId, studentId, status: "UNPAID" },
      orderBy: { id: "desc" },
      select: { id: true, paidAmount: true, totalAmount: true },
    });
    if (!challan) {
      console.log("FAIL");
      return;
    }

    const beforeSummary = await prisma.studentFinancialSummary.findUnique({
      where: { studentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const beforePaymentCount = await prisma.paymentRecord.count({
      where: { organizationId, challanId: challan.id },
    });
    const beforeLedgerCount = await prisma.ledgerEntry.count({
      where: {
        organizationId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        referenceType: "PaymentRecord",
      },
    });

    // D1: force failure after payment insert, before ledger+summary.
    const forced = await requestJson("/api/finance/payments", {
      method: "POST",
      jar,
      body: {
        challanId: challan.id,
        amount: 1,
        paymentDate: new Date().toISOString(),
        paymentMethod: "OTC",
        referenceNumber: `AT-FAIL-${Date.now()}`,
        notes: "[SIMULATE_ATOMIC_FAILURE]",
      },
    });

    const afterSummary = await prisma.studentFinancialSummary.findUnique({
      where: { studentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const afterChallan = await prisma.feeChallan.findUnique({
      where: { id: challan.id },
      select: { paidAmount: true, totalAmount: true, status: true },
    });
    const afterPaymentCount = await prisma.paymentRecord.count({
      where: { organizationId, challanId: challan.id },
    });
    const afterLedgerCount = await prisma.ledgerEntry.count({
      where: {
        organizationId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        referenceType: "PaymentRecord",
      },
    });

    const failedAsExpected = forced.status >= 400;
    const noNewPayment = afterPaymentCount === beforePaymentCount;
    const noNewLedger = afterLedgerCount === beforeLedgerCount;
    const summaryUnchanged =
      Number(afterSummary?.totalCredit ?? 0) === Number(beforeSummary?.totalCredit ?? 0) &&
      Number(afterSummary?.balance ?? 0) === Number(beforeSummary?.balance ?? 0);
    const challanUnchanged = Number(afterChallan?.paidAmount ?? 0) === Number(challan.paidAmount);

    // D3: receipt integrity (no duplicates)
    const recentPayments = await prisma.paymentRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { id: true },
    });
    const receiptCounts = new Map();
    for (const row of recentPayments) {
      const receipt = `RCPT-${row.id.slice(-8).toUpperCase()}`;
      receiptCounts.set(receipt, (receiptCounts.get(receipt) ?? 0) + 1);
    }
    const duplicateReceipts = Array.from(receiptCounts.values()).filter((v) => v > 1).length;
    const receiptIntegrity = duplicateReceipts === 0;

    const pass =
      failedAsExpected &&
      noNewPayment &&
      noNewLedger &&
      summaryUnchanged &&
      challanUnchanged &&
      receiptIntegrity;

    console.log(pass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  }
}

main();
