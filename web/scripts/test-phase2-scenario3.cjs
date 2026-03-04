const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const SUPER_EMAIL = "admin@sairex-sms.com";
const SUPER_PASSWORD = "Admin@123";
const TENANT_EMAIL = "scenario1.tenant.admin@sairex-sms.com";
const TEACHER_EMAIL = "scenario1.teacher@sairex-sms.com";
const DEFAULT_PASSWORD = "Admin@123";
const DEBUG = process.env.DEBUG_SCENARIO3 === "1";

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

async function request(pathname, { method = "GET", jar, body, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (jar) {
    const cookie = jar.header();
    if (cookie) reqHeaders.Cookie = cookie;
  }
  if (body !== undefined) reqHeaders["Content-Type"] = "application/json";

  const started = Date.now();
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const elapsedMs = Date.now() - started;
  jar?.addFromResponse(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, elapsedMs };
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const csrf = await request("/api/auth/csrf", { jar });
  const csrfToken = csrf.json?.csrfToken;
  if (!csrfToken) throw new Error(`Missing CSRF token for ${email}`);

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email, password }).toString(),
    redirect: "manual",
  });
  jar.addFromResponse(res);

  const session = await request("/api/auth/session", { jar });
  if (!session.json?.user?.email) throw new Error(`Login failed for ${email}`);
  return { jar, session: session.json.user };
}

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function ensureUsersAndClass(prisma) {
  const superUser = await prisma.user.findUnique({
    where: { email: SUPER_EMAIL },
    select: { id: true },
  });
  if (!superUser) throw new Error("Super admin missing");

  const membership = await prisma.membership.findFirst({
    where: { userId: superUser.id, status: "ACTIVE" },
    orderBy: { id: "asc" },
    select: { organizationId: true },
  });
  if (!membership?.organizationId) throw new Error("Super admin org missing");

  const classRow = await prisma.class.findFirst({
    where: {
      organizationId: membership.organizationId,
      status: "ACTIVE",
      sections: { some: { status: "ACTIVE" } },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      campusId: true,
      academicYearId: true,
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { id: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!classRow?.id || !classRow.sections[0]?.id) throw new Error("Class/section missing");

  const passHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const tenant = await prisma.user.upsert({
    where: { email: TENANT_EMAIL },
    update: { password: passHash, isActive: true, emailVerifiedAt: new Date() },
    create: {
      email: TENANT_EMAIL,
      password: passHash,
      name: "Scenario Tenant Admin",
      isActive: true,
      emailVerifiedAt: new Date(),
      platformRole: null,
    },
    select: { id: true },
  });
  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: { password: passHash, isActive: true, emailVerifiedAt: new Date() },
    create: {
      email: TEACHER_EMAIL,
      password: passHash,
      name: "Scenario Teacher",
      isActive: true,
      emailVerifiedAt: new Date(),
      platformRole: null,
    },
    select: { id: true },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: tenant.id,
        organizationId: membership.organizationId,
      },
    },
    update: { role: "ORG_ADMIN", status: "ACTIVE", campusId: classRow.campusId },
    create: {
      userId: tenant.id,
      organizationId: membership.organizationId,
      role: "ORG_ADMIN",
      status: "ACTIVE",
      campusId: classRow.campusId,
    },
  });

  const teacherMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: teacher.id,
        organizationId: membership.organizationId,
      },
    },
    update: { role: "TEACHER", status: "ACTIVE", campusId: classRow.campusId },
    create: {
      userId: teacher.id,
      organizationId: membership.organizationId,
      role: "TEACHER",
      status: "ACTIVE",
      campusId: classRow.campusId,
    },
    select: { id: true },
  });

  await prisma.section.update({
    where: { id: classRow.sections[0].id },
    data: { classTeacherId: teacherMembership.id },
  });

  return {
    organizationId: membership.organizationId,
    classId: classRow.id,
    className: classRow.name,
    campusId: classRow.campusId,
    sectionId: classRow.sections[0].id,
  };
}

async function ensureFeeStructure(tenantJar, ctx) {
  const heads = await request("/api/finance/heads", { jar: tenantJar });
  let headId = Array.isArray(heads.json) && heads.json.length ? heads.json[0].id : null;
  if (!headId) {
    const created = await request("/api/finance/heads", {
      method: "POST",
      jar: tenantJar,
      body: { name: `Scenario3 Head ${Date.now()}`, type: "RECURRING" },
    });
    headId = created.json?.id;
  }
  if (!headId) throw new Error("Fee head missing");

  const structures = await request("/api/finance/structures", { jar: tenantJar });
  const existing =
    Array.isArray(structures.json) &&
    structures.json.find(
      (s) => s.campusId === ctx.campusId && (s.applicableGrade === ctx.className || !s.applicableGrade),
    );
  if (existing) return;

  const create = await request("/api/finance/structures", {
    method: "POST",
    jar: tenantJar,
    body: {
      name: `Scenario3 Structure ${Date.now()}`,
      amount: "1300",
      frequency: "MONTHLY",
      applicableGrade: ctx.className,
      campusId: ctx.campusId,
      feeHeadId: headId,
    },
  });
  if (create.status < 200 || create.status >= 300) throw new Error("Fee structure create failed");
}

async function createStudentViaQuickAdmission(tenantJar, ctx, suffix) {
  const resp = await request("/api/mobile/action", {
    method: "POST",
    jar: tenantJar,
    body: {
      type: "ADD_STUDENT_QUICK",
      payload: {
        studentName: `Scenario3 Student ${suffix}`,
        fatherName: "Scenario3 Parent",
        mobileNumber: "03001230000",
        classId: ctx.classId,
      },
    },
  });
  if (resp.status !== 200 || !resp.json?.result?.studentId) throw new Error("Quick admission failed");
  return resp.json.result.studentId;
}

async function issueSingleChallan(tenantJar, studentId, month, year) {
  const resp = await request("/api/mobile/action", {
    method: "POST",
    jar: tenantJar,
    body: {
      type: "ISSUE_CHALLAN",
      payload: { mode: "single", studentId, month, year },
    },
  });
  if (resp.status !== 200 || !(resp.json?.result?.challanIds ?? []).length) {
    throw new Error("Issue challan failed");
  }
  return resp.json.result.challanIds[0];
}

async function collectMobile(tenantJar, studentId, challanId, amount) {
  const resp = await request("/api/mobile/action", {
    method: "POST",
    jar: tenantJar,
    body: {
      type: "COLLECT_FEE",
      payload: { studentId, challanId, amount },
    },
  });
  if (resp.status !== 200 || !resp.json?.result?.paymentRecordId) {
    throw new Error("Mobile collect failed");
  }
  return resp.json.result.paymentRecordId;
}

async function collectAdmin(tenantJar, challanId, amount, paymentDateIso, paymentMethod = "OTC") {
  const resp = await request("/api/finance/payments", {
    method: "POST",
    jar: tenantJar,
    body: {
      challanId,
      amount,
      paymentDate: paymentDateIso,
      paymentMethod,
      referenceNumber: `SC3-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    },
  });
  if (resp.status !== 201 || !resp.json?.data?.paymentRecordId) {
    throw new Error("Admin collect failed");
  }
  return resp.json.data.paymentRecordId;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const ctx = await ensureUsersAndClass(prisma);
    const tenantAuth = await signIn(TENANT_EMAIL, DEFAULT_PASSWORD);
    const tenantJar = tenantAuth.jar;
    await ensureFeeStructure(tenantJar, ctx);

    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const todayIso = now.toISOString();

    // STEP 2.9: 5-10 mixed payments, include newly admitted + mobile payment.
    const studentIds = [
      await createStudentViaQuickAdmission(tenantJar, ctx, `A-${Date.now()}`),
      await createStudentViaQuickAdmission(tenantJar, ctx, `B-${Date.now()}`),
      await createStudentViaQuickAdmission(tenantJar, ctx, `C-${Date.now()}`),
    ];

    const challanIds = [];
    for (const sid of studentIds) {
      challanIds.push(await issueSingleChallan(tenantJar, sid, month, year));
      challanIds.push(await issueSingleChallan(tenantJar, sid, month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year));
    }

    // 6 payments: mixed partial/full + one mobile + one bank transfer.
    const paymentIds = [];
    paymentIds.push(await collectMobile(tenantJar, studentIds[0], challanIds[0], 300)); // mobile partial
    paymentIds.push(await collectAdmin(tenantJar, challanIds[0], 1000, todayIso, "OTC")); // admin complete
    paymentIds.push(await collectAdmin(tenantJar, challanIds[1], 1300, todayIso, "BANK_TRANSFER")); // digital full
    paymentIds.push(await collectAdmin(tenantJar, challanIds[2], 500, todayIso, "OTC")); // partial
    paymentIds.push(await collectAdmin(tenantJar, challanIds[3], 1300, todayIso, "OTC")); // full
    paymentIds.push(await collectAdmin(tenantJar, challanIds[4], 700, todayIso, "OTC")); // partial

    // STEP 2.10: reconciliation from UI endpoint and DB comparison.
    const dailyOpsReport = await request("/api/dashboard/daily-operations", { jar: tenantJar });
    if (dailyOpsReport.status !== 200) throw new Error("Daily operations report failed");
    const uiTotal = Number(dailyOpsReport.json?.kpis?.feeCollectedToday ?? 0);

    const { start: todayStart, end: todayEnd } = dayBounds(new Date());
    const todayPayments = await prisma.paymentRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: paymentIds },
        createdAt: { gte: todayStart, lte: todayEnd },
        status: "RECONCILED",
      },
      select: { id: true, amount: true, paymentChannel: true },
    });
    const dbTodayTotal = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const cashTotal = todayPayments
      .filter((p) => p.paymentChannel === "OTC")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const digitalTotal = todayPayments
      .filter((p) => p.paymentChannel !== "OTC")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const dbReconciliationScope = await prisma.paymentRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: "RECONCILED",
        paidAt: { gte: todayStart, lte: todayEnd },
        challan: { campusId: ctx.campusId },
      },
      select: { amount: true },
    });
    const dbReconciliationTotal = dbReconciliationScope.reduce((sum, p) => sum + Number(p.amount), 0);
    const reportMatchesDb = Math.abs(uiTotal - dbReconciliationTotal) < 0.0001;

    // STEP 2.11: post-reconciliation lock behavior (mutation blocked).
    const putAttempt = await request("/api/finance/payments", {
      method: "PUT",
      jar: tenantJar,
      body: { paymentRecordId: paymentIds[0], amount: 1 },
    });
    const deleteAttempt = await request("/api/finance/payments", {
      method: "DELETE",
      jar: tenantJar,
      body: { paymentRecordId: paymentIds[0] },
    });
    const patchAttempt = await request("/api/finance/payments", {
      method: "PATCH",
      jar: tenantJar,
      body: { paymentRecordId: paymentIds[0], amount: 1 },
    });
    const mutationBlocked =
      (putAttempt.status === 404 || putAttempt.status === 405) &&
      (deleteAttempt.status === 404 || deleteAttempt.status === 405) &&
      (patchAttempt.status === 404 || patchAttempt.status === 405);

    // STEP 2.12: next-day boundary simulation via future-dated paymentDate.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString();
    const futurePaymentId = await collectAdmin(tenantJar, challanIds[5], 300, tomorrowIso, "OTC");

    const futurePayment = await prisma.paymentRecord.findUnique({
      where: { id: futurePaymentId },
      select: { paidAt: true, createdAt: true, amount: true, status: true },
    });
    const todayOpsAfterFuture = await request("/api/dashboard/daily-operations", { jar: tenantJar });
    const uiTotalAfterFuture = Number(todayOpsAfterFuture.json?.kpis?.feeCollectedToday ?? 0);

    const boundaryOk =
      !!futurePayment?.paidAt &&
      futurePayment.paidAt.toISOString().slice(0, 10) === tomorrowIso.slice(0, 10) &&
      Math.abs(uiTotalAfterFuture - uiTotal) < 0.0001;

    const pass =
      todayPayments.length >= 6 &&
      cashTotal > 0 &&
      digitalTotal > 0 &&
      reportMatchesDb &&
      mutationBlocked &&
      boundaryOk;

    if (DEBUG) {
      console.log(JSON.stringify({
        counts: {
          paymentsSimulated: paymentIds.length,
          todayMatchedPayments: todayPayments.length,
        },
        totals: {
          uiTotal,
          dbTodayTotal,
          dbReconciliationTotal,
          cashTotal,
          digitalTotal,
          uiTotalAfterFuture,
        },
        mutation: {
          put: putAttempt.status,
          delete: deleteAttempt.status,
          patch: patchAttempt.status,
        },
        boundary: {
          futurePaymentId,
          paidAt: futurePayment?.paidAt?.toISOString() ?? null,
          createdAt: futurePayment?.createdAt?.toISOString() ?? null,
        },
      }, null, 2));
    }

    console.log(pass ? "PASS" : "FAIL");
  } catch (error) {
    if (DEBUG) {
      console.error(error);
    }
    console.log("FAIL");
  }
}

main();
