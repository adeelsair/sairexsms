const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
    ) value = value.slice(1, -1);
    process.env.DATABASE_URL = value;
    return;
  }
}

class CookieJar {
  constructor() { this.map = new Map(); }
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
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function buildManualIdempotencyKey(input) {
  const dateToken = new Date(input.paymentDate).toISOString().slice(0, 10);
  const ref = (input.referenceNumber ?? "").trim().toUpperCase();
  const payload = [
    input.organizationId,
    String(input.challanId),
    Number(input.amount).toFixed(2),
    dateToken,
    input.paymentMethod,
    ref,
  ].join("|");
  return `manual:${crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32)}`;
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

    // Controlled fixture to ensure an unpaid challan exists.
    const classesRes = await requestJson("/api/mobile/attendance/classes", { jar });
    const classes = listFrom(classesRes.data);
    const cls = classes[0];
    if (!cls?.campusId || !cls?.className) {
      console.log("FAIL");
      return;
    }

    const student = await requestJson("/api/students", {
      method: "POST",
      jar,
      body: {
        fullName: `Double Entry Test ${Date.now()}`,
        admissionNo: `DBL-${Date.now()}`,
        grade: cls.className,
        campusId: cls.campusId,
      },
    });
    const studentId = student.data?.id;
    if (!studentId) {
      console.log("FAIL");
      return;
    }

    const head = await requestJson("/api/finance/heads", {
      method: "POST",
      jar,
      body: { name: `Double Head ${Date.now()}`, type: "RECURRING" },
    });
    const feeHeadId = head.data?.id;
    if (!feeHeadId) {
      console.log("FAIL");
      return;
    }

    const structure = await requestJson("/api/finance/structures", {
      method: "POST",
      jar,
      body: {
        name: `Double Structure ${Date.now()}`,
        amount: "1000",
        frequency: "MONTHLY",
        applicableGrade: cls.className,
        campusId: cls.campusId,
        feeHeadId,
      },
    });
    if (structure.status < 200 || structure.status >= 300) {
      console.log("FAIL");
      return;
    }

    const billingMonth = `DB${Date.now().toString(36).toUpperCase()}`;
    const challanGen = await requestJson("/api/finance/challans", {
      method: "POST",
      jar,
      body: {
        campusId: cls.campusId,
        targetGrade: cls.className,
        billingMonth,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    if (challanGen.status < 200 || challanGen.status >= 300) {
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
      select: { id: true },
    });
    if (!challan?.id) {
      console.log("FAIL");
      return;
    }

    const paymentPayload = {
      challanId: challan.id,
      amount: 1,
      paymentDate: new Date().toISOString(),
      paymentMethod: "OTC",
      referenceNumber: `DBL-REF-${Date.now()}`,
    };
    const idempotencyKey = buildManualIdempotencyKey({
      organizationId,
      ...paymentPayload,
    });

    const t0 = new Date();

    // B1: Rapid double click simulation (concurrent identical requests)
    const [fastA, fastB] = await Promise.all([
      requestJson("/api/finance/payments", { method: "POST", jar, body: paymentPayload }),
      requestJson("/api/finance/payments", { method: "POST", jar, body: paymentPayload }),
    ]);

    const payRowsAfterFast = await prisma.paymentRecord.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        gateway: "MANUAL",
        gatewayRef: idempotencyKey,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, transactionRef: true, gatewayRef: true, createdAt: true },
    });
    const ledgerRowsAfterFast = await prisma.ledgerEntry.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        referenceType: "PaymentRecord",
        createdAt: { gte: t0 },
      },
      select: { id: true, referenceId: true, amount: true, createdAt: true },
    });

    const b1StatusOk =
      (fastA.status === 201 && fastB.status >= 400) ||
      (fastB.status === 201 && fastA.status >= 400);
    const b1RowsOk = payRowsAfterFast.length === 1 && ledgerRowsAfterFast.length === 1;
    const b1ReceiptOk = new Set(payRowsAfterFast.map((r) => `RCPT-${r.id.slice(-8).toUpperCase()}`)).size === 1;

    // B2: Manual replay (same payload twice after initial)
    const replay1 = await requestJson("/api/finance/payments", { method: "POST", jar, body: paymentPayload });
    const replay2 = await requestJson("/api/finance/payments", { method: "POST", jar, body: paymentPayload });
    const payRowsAfterReplay = await prisma.paymentRecord.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        gateway: "MANUAL",
        gatewayRef: idempotencyKey,
      },
      select: { id: true },
    });
    const ledgerRowsAfterReplay = await prisma.ledgerEntry.findMany({
      where: {
        organizationId,
        challanId: challan.id,
        entryType: "PAYMENT_RECEIVED",
        referenceType: "PaymentRecord",
        createdAt: { gte: t0 },
      },
      select: { id: true },
    });
    const b2Ok =
      replay1.status >= 400 &&
      replay2.status >= 400 &&
      payRowsAfterReplay.length === 1 &&
      ledgerRowsAfterReplay.length === 1;

    // B3: Receipt integrity (derived receipt token uniqueness)
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
    const b3Ok = duplicateReceipts === 0;

    const pass = b1StatusOk && b1RowsOk && b1ReceiptOk && b2Ok && b3Ok;
    console.log(pass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  }
}

main();
