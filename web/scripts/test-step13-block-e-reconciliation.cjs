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

function todayUtcWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return { start, end };
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
        fullName: `Recon Test ${Date.now()}`,
        admissionNo: `RE-${Date.now()}`,
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
      body: { name: `Recon Head ${Date.now()}`, type: "RECURRING" },
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
        name: `Recon Structure ${Date.now()}`,
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

    const runTag = `E2E-RECON-${Date.now()}`;
    const challanRes = await requestJson("/api/finance/challans", {
      method: "POST",
      jar,
      body: {
        campusId: cls.campusId,
        targetGrade: cls.className,
        billingMonth: `RE${Date.now().toString(36).toUpperCase()}`,
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
      select: { id: true },
    });
    if (!challan) {
      console.log("FAIL");
      return;
    }

    const paymentsToCollect = [200, 300];
    let manualTally = 0;
    const paymentIds = [];
    for (const amount of paymentsToCollect) {
      const paid = await requestJson("/api/finance/payments", {
        method: "POST",
        jar,
        body: {
          challanId: challan.id,
          amount,
          paymentDate: new Date().toISOString(),
          paymentMethod: "OTC",
          referenceNumber: `${runTag}-${amount}-${Date.now()}`,
        },
      });
      if (paid.status !== 201 || !paid.data?.ok || !paid.data?.data?.paymentRecordId) {
        console.log("FAIL");
        return;
      }
      manualTally += amount;
      paymentIds.push(paid.data.data.paymentRecordId);
    }

    // E1 + E2: DB payment totals and ledger totals align with manual tally.
    const { start, end } = todayUtcWindow();

    const dbPayments = await prisma.paymentRecord.findMany({
      where: {
        organizationId,
        id: { in: paymentIds },
        createdAt: { gte: start, lt: end },
      },
      select: { id: true, amount: true },
    });
    const dbPaymentTotal = dbPayments.reduce((sum, row) => sum + Number(row.amount), 0);

    const dbLedgerRows = await prisma.ledgerEntry.findMany({
      where: {
        organizationId,
        referenceType: "PaymentRecord",
        referenceId: { in: paymentIds },
        entryType: "PAYMENT_RECEIVED",
        direction: "CREDIT",
        createdAt: { gte: start, lt: end },
      },
      select: { amount: true },
    });
    const dbLedgerTotal = dbLedgerRows.reduce((sum, row) => sum + Number(row.amount), 0);

    const e1e2Ok =
      dbPayments.length === paymentsToCollect.length &&
      dbLedgerRows.length === paymentsToCollect.length &&
      dbPaymentTotal === manualTally &&
      dbLedgerTotal === manualTally;

    // E3: post-reconciliation mutation should be blocked (no mutation endpoints).
    const putAttempt = await requestJson("/api/finance/payments", {
      method: "PUT",
      jar,
      body: { paymentRecordId: paymentIds[0], amount: 1 },
    });
    const deleteAttempt = await requestJson("/api/finance/payments", {
      method: "DELETE",
      jar,
      body: { paymentRecordId: paymentIds[0] },
    });
    const e3Ok =
      (putAttempt.status === 404 || putAttempt.status === 405) &&
      (deleteAttempt.status === 404 || deleteAttempt.status === 405);

    // E4: backdated attempt should be blocked or explicitly controlled.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const backdatedAttempt = await requestJson("/api/finance/payments", {
      method: "POST",
      jar,
      body: {
        challanId: challan.id,
        amount: 1,
        paymentDate: yesterday.toISOString(),
        paymentMethod: "OTC",
        referenceNumber: `${runTag}-BACKDATED`,
      },
    });

    const backdatedCreated = await prisma.paymentRecord.findFirst({
      where: {
        organizationId,
        transactionRef: `${runTag}-BACKDATED`,
      },
      select: { id: true },
    });
    const e4Ok = backdatedAttempt.status >= 400 && !backdatedCreated;

    const pass = e1e2Ok && e3Ok && e4Ok;
    console.log(pass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  }
}

main();
