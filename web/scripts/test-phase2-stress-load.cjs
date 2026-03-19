const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { execSync } = require("child_process");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const SUPER_EMAIL = "admin@sairex-sms.com";
const SUPER_PASSWORD = "Admin@123";
const TENANT_EMAIL = "scenario1.tenant.admin@sairex-sms.com";
const TEACHER_EMAIL = "scenario1.teacher@sairex-sms.com";
const DEFAULT_PASSWORD = "Admin@123";
const DEBUG = process.env.DEBUG_STRESS_LOAD === "1";

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
  return { status: res.status, elapsedMs, json, text };
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const login = await request("/api/login", {
    method: "POST",
    jar,
    body: { email, password },
  });
  if (login.status < 200 || login.status >= 300) {
    throw new Error(`Local login failed for ${email}`);
  }
  const session = await request("/api/auth/session", { jar });
  if (!session.json?.user?.email) throw new Error(`Login failed for ${email}`);
  return { jar, session: session.json.user };
}

function parseMemUsageMb(value) {
  const cleaned = String(value).replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  return Math.round((Number(cleaned) / 1024) * 100) / 100;
}

function getNodeMaxMemoryMb() {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: "utf8" });
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.includes("No tasks are running"));
    if (!lines.length) return 0;
    let max = 0;
    for (const line of lines) {
      const cols = line.replace(/^"|"$/g, "").split('","');
      const mem = parseMemUsageMb(cols[4] ?? "0");
      if (mem > max) max = mem;
    }
    return max;
  } catch {
    return 0;
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
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
  if (!membership?.organizationId) throw new Error("Organization context missing");

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
    campusId: classRow.campusId,
    classId: classRow.id,
    className: classRow.name,
    sectionId: classRow.sections[0].id,
    academicYearId: classRow.academicYearId,
  };
}

async function ensureFeeStructure(tenantJar, ctx) {
  const heads = await request("/api/finance/heads", { jar: tenantJar });
  let feeHeadId = Array.isArray(heads.json) && heads.json.length > 0 ? heads.json[0].id : null;
  if (!feeHeadId) {
    const created = await request("/api/finance/heads", {
      method: "POST",
      jar: tenantJar,
      body: { name: `Stress Head ${Date.now()}`, type: "RECURRING" },
    });
    feeHeadId = created.json?.id;
  }
  if (!feeHeadId) throw new Error("Fee head resolution failed");

  const structures = await request("/api/finance/structures", { jar: tenantJar });
  const exists =
    Array.isArray(structures.json) &&
    structures.json.some((s) => s.campusId === ctx.campusId && s.applicableGrade === ctx.className);
  if (exists) return;

  const created = await request("/api/finance/structures", {
    method: "POST",
    jar: tenantJar,
    body: {
      name: `Stress Structure ${Date.now()}`,
      amount: "1400",
      frequency: "MONTHLY",
      applicableGrade: ctx.className,
      campusId: ctx.campusId,
      feeHeadId,
    },
  });
  if (created.status < 200 || created.status >= 300) throw new Error("Fee structure creation failed");
}

async function countDataset(prisma) {
  const [students, payments, ledger] = await Promise.all([
    prisma.student.count(),
    prisma.paymentRecord.count(),
    prisma.ledgerEntry.count(),
  ]);
  return { students, payments, ledger };
}

async function seedDatasetIfNeeded(prisma, ctx) {
  const before = await countDataset(prisma);
  const targetStudents = 10000;
  const targetLedger = 50000;
  const studentNeeded = Math.max(targetStudents - before.students, 0);

  if (studentNeeded > 0) {
    const stamp = Date.now();
    const batchSize = 1000;
    for (let i = 0; i < studentNeeded; i += batchSize) {
      const size = Math.min(batchSize, studentNeeded - i);
      const rows = Array.from({ length: size }, (_, idx) => {
        const seq = i + idx + 1;
        return {
          fullName: `Load Student ${stamp}-${seq}`,
          admissionNo: `LD-${stamp}-${seq}`,
          grade: ctx.className,
          organizationId: ctx.organizationId,
          campusId: ctx.campusId,
          feeStatus: "Unpaid",
        };
      });
      await prisma.student.createMany({ data: rows });
    }
  }

  const studentIds = await prisma.student.findMany({
    where: { organizationId: ctx.organizationId, campusId: ctx.campusId },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 20000,
  });
  if (!studentIds.length) throw new Error("No students available for ledger seeding");

  const afterStudents = await countDataset(prisma);
  const ledgerNeeded = Math.max(targetLedger - afterStudents.ledger, 0);
  if (ledgerNeeded > 0) {
    const batchSize = 2000;
    const stamp = Date.now();
    for (let i = 0; i < ledgerNeeded; i += batchSize) {
      const size = Math.min(batchSize, ledgerNeeded - i);
      const rows = Array.from({ length: size }, (_, idx) => {
        const seq = i + idx;
        const sid = studentIds[seq % studentIds.length].id;
        return {
          organizationId: ctx.organizationId,
          studentId: sid,
          campusId: ctx.campusId,
          entryType: "CHALLAN_CREATED",
          direction: "DEBIT",
          amount: 100,
          referenceType: "LOAD_SEED",
          referenceId: `seed-${stamp}-${seq}`,
        };
      });
      await prisma.ledgerEntry.createMany({ data: rows });
    }
  }

  const after = await countDataset(prisma);
  return { before, after };
}

async function createLoadFixtures(tenantJar, ctx, count) {
  const studentsCreated = [];
  for (let i = 0; i < count; i += 1) {
    const admitted = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ADD_STUDENT_QUICK",
        payload: {
          studentName: `LoadUser ${Date.now()}-${i}`,
          fatherName: "Load Parent",
          mobileNumber: "03001234567",
          classId: ctx.classId,
        },
      },
    });
    if (admitted.status !== 200 || !admitted.json?.result?.studentId) {
      throw new Error("Fixture quick admission failed");
    }
    studentsCreated.push(admitted.json.result.studentId);
  }

  const month = new Date().getUTCMonth() + 1;
  const year = new Date().getUTCFullYear();
  const pairs = [];
  for (const studentId of studentsCreated) {
    const challan = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ISSUE_CHALLAN",
        payload: { mode: "single", studentId, month, year },
      },
    });
    if (challan.status !== 200 || !(challan.json?.result?.challanIds ?? []).length) {
      throw new Error("Fixture challan generation failed");
    }
    pairs.push({
      studentId,
      challanId: challan.json.result.challanIds[0],
    });
  }
  return pairs;
}

async function runConcurrent(count, fn) {
  const latencies = [];
  const statuses = [];
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      (async () => {
        const started = Date.now();
        const status = await fn(i);
        const ms = Date.now() - started;
        latencies.push(ms);
        statuses.push(status);
      })(),
    ),
  );
  const okCount = statuses.filter((s) => s >= 200 && s < 300).length;
  const errorCount = statuses.length - okCount;
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  return {
    users: count,
    avgMs: Math.round(avg),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    okCount,
    errorCount,
  };
}

async function explainExecutionMs(prisma, sql) {
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  let execMs = 0;
  for (const row of rows) {
    const text = row["QUERY PLAN"] || "";
    const match = /Execution Time: ([\d.]+) ms/i.exec(text);
    if (match) {
      execMs = Number(match[1]);
      break;
    }
  }
  return execMs;
}

async function checkAndAddIndexes(prisma) {
  const existing = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('PaymentRecord', 'FeeChallan', 'LedgerEntry', 'Student');
  `);

  const defs = existing.map((r) => String(r.indexdef));
  const hasPaymentCreatedAt = defs.some((d) => d.includes('"PaymentRecord"') && d.includes('("createdAt")'));
  const hasPaymentOrgCreatedAt = defs.some((d) => d.includes('"PaymentRecord"') && d.includes('("organizationId", "createdAt")'));

  const added = [];
  if (!hasPaymentOrgCreatedAt) {
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PaymentRecord_org_createdAt_idx" ON "PaymentRecord" ("organizationId", "createdAt");',
    );
    added.push("PaymentRecord_org_createdAt_idx");
  } else if (!hasPaymentCreatedAt) {
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PaymentRecord_createdAt_idx" ON "PaymentRecord" ("createdAt");',
    );
    added.push("PaymentRecord_createdAt_idx");
  }
  return added;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const memoryBefore = getNodeMaxMemoryMb();
    const ctx = await ensureUsersAndClass(prisma);
    const tenantAuth = await signIn(TENANT_EMAIL, DEFAULT_PASSWORD);
    const teacherAuth = await signIn(TEACHER_EMAIL, DEFAULT_PASSWORD);
    const tenantJar = tenantAuth.jar;
    const teacherJar = teacherAuth.jar;

    await ensureFeeStructure(tenantJar, ctx);

    const dataset = await seedDatasetIfNeeded(prisma, ctx);

    // Prepare enough unique fee-collection fixtures for two distinct waves (50 + 100).
    const feeFixtures = await createLoadFixtures(tenantJar, ctx, 180);

    // Attendance payload fixture
    const classes = await request("/api/mobile/attendance/classes", { jar: teacherJar });
    const rows = Array.isArray(classes.json) ? classes.json : [];
    const picked = rows.find((r) => r.sectionId === ctx.sectionId) ?? rows[0];
    if (!picked?.sectionId) throw new Error("No teacher section for attendance load");
    const sectionStudentsRes = await request(
      `/api/mobile/attendance/students?sectionId=${encodeURIComponent(picked.sectionId)}`,
      { jar: teacherJar },
    );
    const sectionStudents = sectionStudentsRes.json?.students ?? [];
    if (!sectionStudents.length) throw new Error("No section students available");
    const attendanceEntries = sectionStudents.map((s, idx) => ({
      enrollmentId: s.enrollmentId,
      studentId: s.studentId,
      status: idx % 7 === 0 ? "ABSENT" : "PRESENT",
    }));

    const todayIso = new Date().toISOString().slice(0, 10);

    // Measure dashboard stats path directly (the route used by dashboard metrics).
    const dashboard50 = await runConcurrent(50, async () => {
      const res = await request("/api/dashboard?view=stats", {
        jar: tenantJar,
        headers: { Accept: "application/json" },
      });
      return res.status;
    });
    const dashboard100 = await runConcurrent(100, async () => {
      const res = await request("/api/dashboard?view=stats", {
        jar: tenantJar,
        headers: { Accept: "application/json" },
      });
      return res.status;
    });

    const fee50 = await runConcurrent(50, async (i) => {
      const item = feeFixtures[i];
      const res = await request("/api/mobile/action", {
        method: "POST",
        jar: tenantJar,
        body: {
          type: "COLLECT_FEE",
          payload: {
            studentId: item.studentId,
            challanId: item.challanId,
            amount: 100,
          },
        },
      });
      return res.status;
    });
    const fee100 = await runConcurrent(100, async (i) => {
      const item = feeFixtures[i + 50];
      const res = await request("/api/mobile/action", {
        method: "POST",
        jar: tenantJar,
        body: {
          type: "COLLECT_FEE",
          payload: {
            studentId: item.studentId,
            challanId: item.challanId,
            amount: 100,
          },
        },
      });
      return res.status;
    });

    const attendance50 = await runConcurrent(50, async () => {
      const res = await request("/api/academic/attendance", {
        method: "POST",
        jar: teacherJar,
        body: {
          academicYearId: picked.academicYearId,
          campusId: picked.campusId,
          classId: picked.classId,
          sectionId: picked.sectionId,
          date: todayIso,
          entries: attendanceEntries,
        },
      });
      return res.status;
    });
    const attendance100 = await runConcurrent(100, async () => {
      const res = await request("/api/academic/attendance", {
        method: "POST",
        jar: teacherJar,
        body: {
          academicYearId: picked.academicYearId,
          campusId: picked.campusId,
          classId: picked.classId,
          sectionId: picked.sectionId,
          date: todayIso,
          entries: attendanceEntries,
        },
      });
      return res.status;
    });

    // Slow query detection
    const { start, end } = (() => {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString() };
    })();

    const q1 = await explainExecutionMs(
      prisma,
      `SELECT SUM("amount") FROM "PaymentRecord" WHERE "organizationId"='${ctx.organizationId}' AND "status"='RECONCILED' AND "createdAt" BETWEEN '${start}'::timestamptz AND '${end}'::timestamptz`,
    );
    const q2 = await explainExecutionMs(
      prisma,
      `SELECT * FROM "Attendance" WHERE "organizationId"='${ctx.organizationId}' AND "sectionId"='${picked.sectionId}' AND "date"='${todayIso}'::timestamptz`,
    );
    const q3 = await explainExecutionMs(
      prisma,
      `SELECT * FROM "FeeChallan" WHERE "organizationId"='${ctx.organizationId}' AND "studentId"=${feeFixtures[0].studentId} AND "status" IN ('UNPAID','PARTIALLY_PAID')`,
    );
    const slowQueries = [
      { name: "payments_daily_sum", ms: q1 },
      { name: "attendance_section_day", ms: q2 },
      { name: "challan_outstanding_student", ms: q3 },
    ].filter((q) => q.ms > 300);

    const addedIndexes = await checkAndAddIndexes(prisma);

    const memoryAfter = getNodeMaxMemoryMb();
    const memGrowth = memoryAfter > 0 && memoryBefore > 0
      ? Math.round(((memoryAfter - memoryBefore) / memoryBefore) * 100)
      : 0;

    const dashboardTargetOk = dashboard50.avgMs < 2000 && dashboard100.avgMs < 2000;
    const feeTargetOk = fee50.avgMs < 500 && fee100.avgMs < 500;
    const concurrencyOk =
      dashboardTargetOk &&
      feeTargetOk &&
      attendance50.errorCount === 0 &&
      attendance100.errorCount === 0 &&
      fee50.errorCount === 0 &&
      fee100.errorCount === 0;

    const result = {
      dataset,
      concurrency: {
        dashboard50,
        dashboard100,
        fee50,
        fee100,
        attendance50,
        attendance100,
        targets: {
          dashboardUnder2s: dashboardTargetOk,
          feeUnder500ms: feeTargetOk,
          stableNoErrors: concurrencyOk,
        },
      },
      queryProbe: {
        measurementsMs: {
          paymentsDailySum: q1,
          attendanceSectionDay: q2,
          challanOutstandingStudent: q3,
        },
        slowQueries,
        addedIndexes,
        notes: {
          receiptNumberColumn: false,
          challanNumberColumnEquivalent: "challanNo",
        },
      },
      memory: {
        beforeMb: memoryBefore,
        afterMb: memoryAfter,
        growthPercent: memGrowth,
        stable: memGrowth < 30,
      },
    };

    if (DEBUG) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify(result));
    }
  } catch (error) {
    if (DEBUG) console.error(error);
    console.log(JSON.stringify({ error: "STRESS_LOAD_FAILED" }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
