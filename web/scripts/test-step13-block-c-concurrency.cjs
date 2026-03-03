const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@sairex-sms.com";
const PASSWORD = "Admin@123";
const DEBUG = process.env.DEBUG_CONCURRENCY === "1";

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
    const jarA = await signIn();
    const jarB = await signIn();

    const session = await requestJson("/api/auth/session", { jar: jarA });
    const organizationId = session.data?.user?.organizationId;
    if (!organizationId) {
      console.log("FAIL");
      return;
    }

    const classesRes = await requestJson("/api/mobile/attendance/classes", { jar: jarA });
    const classes = listFrom(classesRes.data);
    const cls = classes[0];
    if (!cls?.campusId || !cls?.className) {
      console.log("FAIL");
      return;
    }

    const studentRes = await requestJson("/api/students", {
      method: "POST",
      jar: jarA,
      body: {
        fullName: `Concurrency Test ${Date.now()}`,
        admissionNo: `CC-${Date.now()}`,
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
      jar: jarA,
      body: { name: `Concurrency Head ${Date.now()}`, type: "RECURRING" },
    });
    const feeHeadId = headRes.data?.id;
    if (!feeHeadId) {
      console.log("FAIL");
      return;
    }

    const structureRes = await requestJson("/api/finance/structures", {
      method: "POST",
      jar: jarA,
      body: {
        name: `Concurrency Structure ${Date.now()}`,
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

    const challanGenRes = await requestJson("/api/finance/challans", {
      method: "POST",
      jar: jarA,
      body: {
        campusId: cls.campusId,
        targetGrade: cls.className,
        billingMonth: `CC${Date.now().toString(36).toUpperCase()}`,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    if (challanGenRes.status < 200 || challanGenRes.status >= 300) {
      console.log("FAIL");
      return;
    }

    const challan = await prisma.feeChallan.findFirst({
      where: {
        organizationId,
        studentId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      orderBy: { id: "desc" },
      select: { id: true, totalAmount: true, paidAmount: true },
    });
    if (!challan) {
      console.log("FAIL");
      return;
    }

    const remaining = Number(challan.totalAmount) - Number(challan.paidAmount);
    if (remaining <= 0) {
      console.log("FAIL");
      return;
    }

    const t0 = new Date();
    const payloadA = {
      challanId: challan.id,
      amount: remaining,
      paymentDate: new Date().toISOString(),
      paymentMethod: "OTC",
      referenceNumber: `CC-A-${Date.now()}`,
    };
    const payloadB = {
      challanId: challan.id,
      amount: remaining,
      paymentDate: new Date().toISOString(),
      paymentMethod: "OTC",
      referenceNumber: `CC-B-${Date.now()}`,
    };

    const [r1, r2] = await Promise.all([
      requestJson("/api/finance/payments", { method: "POST", jar: jarA, body: payloadA }),
      requestJson("/api/finance/payments", { method: "POST", jar: jarB, body: payloadB }),
    ]);

    const after = await prisma.feeChallan.findUnique({
      where: { id: challan.id },
      select: { paidAmount: true, totalAmount: true, status: true, studentId: true, campusId: true },
    });
    if (!after) {
      console.log("FAIL");
      return;
    }

    const payments = await prisma.paymentRecord.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        createdAt: { gte: t0 },
        status: "RECONCILED",
      },
      select: { id: true, amount: true, transactionRef: true },
    });

    const ledgers = await prisma.ledgerEntry.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        referenceType: "PaymentRecord",
        createdAt: { gte: t0 },
      },
      select: { id: true, referenceId: true, amount: true },
    });

    const summary = await prisma.studentFinancialSummary.findUnique({
      where: { studentId: after.studentId },
      select: { balance: true },
    });

    const oneSuccessOnly =
      (r1.status === 201 && r2.status >= 400) || (r2.status === 201 && r1.status >= 400);
    const noOverpay = Number(after.paidAmount) <= Number(after.totalAmount);
    const onePayment = payments.length === 1;
    const oneLedger = ledgers.length === 1;
    const balanceNonNegative = Number(summary?.balance ?? 0) >= 0;

    if (DEBUG) {
      console.log(JSON.stringify({
        statuses: [r1.status, r2.status],
        responseErrors: [r1.data?.error ?? null, r2.data?.error ?? null],
        challanAfter: {
          paidAmount: Number(after.paidAmount),
          totalAmount: Number(after.totalAmount),
          status: after.status,
        },
        paymentsCount: payments.length,
        ledgersCount: ledgers.length,
        summaryBalance: Number(summary?.balance ?? 0),
      }, null, 2));
    }

    const pass = oneSuccessOnly && noOverpay && onePayment && oneLedger && balanceNonNegative;
    console.log(pass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  }
}

main();
