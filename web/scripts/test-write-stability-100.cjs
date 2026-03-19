const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const SUPER_EMAIL = "admin@sairex-sms.com";
const TENANT_EMAIL = "scenario1.tenant.admin@sairex-sms.com";
const TEACHER_EMAIL = "scenario1.teacher@sairex-sms.com";
const DEFAULT_PASSWORD = "Admin@123";

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
  try { json = JSON.parse(text); } catch {}
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
    const { execSync } = require("child_process");
    const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: "utf8" });
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let max = 0;
    for (const line of lines) {
      if (line.includes("No tasks are running")) continue;
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
  const exists = Array.isArray(structures.json) &&
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
    pairs.push({ studentId, challanId: challan.json.result.challanIds[0] });
  }
  return pairs;
}

async function runConcurrent(count, fn) {
  const latencies = [];
  const statuses = [];
  await Promise.all(Array.from({ length: count }, (_, i) => (async () => {
    const started = Date.now();
    const status = await fn(i);
    latencies.push(Date.now() - started);
    statuses.push(status);
  })()));
  const okCount = statuses.filter((s) => s >= 200 && s < 300).length;
  return {
    users: count,
    avgMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    okCount,
    errorCount: statuses.length - okCount,
  };
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
    const feeFixtures = await createLoadFixtures(tenantJar, ctx, 120);

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

    const fee100 = await runConcurrent(100, async (i) => {
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

    const memoryAfter = getNodeMaxMemoryMb();
    const result = {
      fee100,
      attendance100,
      errors: {
        fee100: fee100.errorCount,
        attendance100: attendance100.errorCount,
      },
      memory: {
        beforeMb: memoryBefore,
        afterMb: memoryAfter,
        growthPercent:
          memoryBefore > 0 ? Math.round(((memoryAfter - memoryBefore) / memoryBefore) * 100) : 0,
      },
    };

    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({ error: "WRITE_STABILITY_FAILED", message: String(error) }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
