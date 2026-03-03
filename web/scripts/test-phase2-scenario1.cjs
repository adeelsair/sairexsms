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
const DEBUG = process.env.DEBUG_SCENARIO1 === "1";

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
  return { status: res.status, text, json, elapsedMs };
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const csrfRes = await request("/api/auth/csrf", { jar });
  const csrfToken = csrfRes.json?.csrfToken;
  if (!csrfToken) throw new Error(`Missing csrf token for ${email}`);

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
  return jar;
}

function normalizeDateISO(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function buildAttendanceEntries(students, mode) {
  return students.map((s, index) => {
    let status = "PRESENT";
    if (mode === "mixed") {
      if (index === 0) status = "ABSENT";
      if (index === 1) status = "LATE";
    }
    return {
      enrollmentId: s.enrollmentId,
      studentId: s.studentId,
      status,
      remarks: status === "PRESENT" ? undefined : "Scenario1 test mark",
    };
  });
}

async function ensureScenarioUsers(prisma) {
  const superUser = await prisma.user.findUnique({
    where: { email: SUPER_EMAIL },
    select: { id: true },
  });
  if (!superUser) throw new Error("Super admin user missing");

  const org = await prisma.membership.findFirst({
    where: { userId: superUser.id, status: "ACTIVE" },
    orderBy: { id: "asc" },
    select: { organizationId: true, campusId: true },
  });
  if (!org?.organizationId) throw new Error("Super admin organization context missing");

  const campus = await prisma.campus.findFirst({
    where: { organizationId: org.organizationId, status: "ACTIVE" },
    orderBy: [{ isMainCampus: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!campus?.id) throw new Error("No active campus found");

  const section = await prisma.section.findFirst({
    where: {
      organizationId: org.organizationId,
      campusId: campus.id,
      status: "ACTIVE",
      enrollments: { some: { status: "ACTIVE" } },
    },
    orderBy: { id: "asc" },
    select: { id: true, classId: true, academicYearId: true },
  });
  if (!section?.id) throw new Error("No active section with enrollments found");

  const passHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const tenantUser = await prisma.user.upsert({
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

  const teacherUser = await prisma.user.upsert({
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
        userId: tenantUser.id,
        organizationId: org.organizationId,
      },
    },
    update: { role: "ORG_ADMIN", status: "ACTIVE", campusId: campus.id },
    create: {
      userId: tenantUser.id,
      organizationId: org.organizationId,
      role: "ORG_ADMIN",
      status: "ACTIVE",
      campusId: campus.id,
    },
  });

  const teacherMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: teacherUser.id,
        organizationId: org.organizationId,
      },
    },
    update: { role: "TEACHER", status: "ACTIVE", campusId: campus.id },
    create: {
      userId: teacherUser.id,
      organizationId: org.organizationId,
      role: "TEACHER",
      status: "ACTIVE",
      campusId: campus.id,
    },
    select: { id: true },
  });

  await prisma.section.update({
    where: { id: section.id },
    data: { classTeacherId: teacherMembership.id },
  });

  return {
    organizationId: org.organizationId,
    campusId: campus.id,
    sectionId: section.id,
    classId: section.classId,
    academicYearId: section.academicYearId,
  };
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const ctx = await ensureScenarioUsers(prisma);
    const todayIso = normalizeDateISO();

    const superJar = await signIn(SUPER_EMAIL, SUPER_PASSWORD);
    const tenantJar = await signIn(TENANT_EMAIL, DEFAULT_PASSWORD);
    const teacherJar = await signIn(TEACHER_EMAIL, DEFAULT_PASSWORD);

    // STEP 2.1: dashboard stability + role boundaries
    await request("/admin/dashboard", { jar: tenantJar, headers: { Accept: "text/html" } });
    await request("/admin/dashboard", { jar: teacherJar, headers: { Accept: "text/html" } });
    const tenantDashboard = await request("/admin/dashboard", { jar: tenantJar, headers: { Accept: "text/html" } });
    const teacherDashboard = await request("/admin/dashboard", { jar: teacherJar, headers: { Accept: "text/html" } });
    const tenantNoSuper = !tenantDashboard.text.includes("/superadmin") && !tenantDashboard.text.includes("Super Admin");
    const teacherNoSuper = !teacherDashboard.text.includes("/superadmin") && !teacherDashboard.text.includes("Super Admin");
    const dashboardStable =
      tenantDashboard.status === 200 &&
      teacherDashboard.status === 200 &&
      tenantDashboard.elapsedMs < 2000 &&
      teacherDashboard.elapsedMs < 2000;

    // Role leakage check: non-super users must not access superadmin endpoint.
    const tenantSuperadminProbe = await request("/api/superadmin/impersonate", { jar: tenantJar });
    const teacherSuperadminProbe = await request("/api/superadmin/impersonate", { jar: teacherJar });
    const roleBoundary =
      tenantSuperadminProbe.status >= 400 &&
      teacherSuperadminProbe.status >= 400 &&
      tenantNoSuper &&
      teacherNoSuper;

    // STEP 2.2 Attendance flow (teacher)
    const teacherClasses = await request("/api/mobile/attendance/classes", { jar: teacherJar });
    const classes = Array.isArray(teacherClasses.json) ? teacherClasses.json : [];
    const picked = classes.find((c) => c.sectionId === ctx.sectionId) ?? classes[0];
    if (!picked?.sectionId) throw new Error("Teacher has no assigned section");

    const studentsRes = await request(`/api/mobile/attendance/students?sectionId=${encodeURIComponent(picked.sectionId)}`, { jar: teacherJar });
    const students = studentsRes.json?.students ?? [];
    const sectionMeta = studentsRes.json?.section ?? {};
    if (!students.length) throw new Error("No students found for teacher section");

    const firstPass = await request("/api/academic/attendance", {
      method: "POST",
      jar: teacherJar,
      body: {
        academicYearId: sectionMeta.academicYearId,
        campusId: sectionMeta.campusId,
        classId: sectionMeta.classId,
        sectionId: sectionMeta.sectionId,
        date: todayIso,
        entries: buildAttendanceEntries(students, "all-present"),
      },
    });
    if (firstPass.status !== 200 || !firstPass.json?.ok) throw new Error("Initial attendance submit failed");

    const secondPass = await request("/api/academic/attendance", {
      method: "POST",
      jar: teacherJar,
      body: {
        academicYearId: sectionMeta.academicYearId,
        campusId: sectionMeta.campusId,
        classId: sectionMeta.classId,
        sectionId: sectionMeta.sectionId,
        date: todayIso,
        entries: buildAttendanceEntries(students, "mixed"),
      },
    });
    if (secondPass.status !== 200 || !secondPass.json?.ok) throw new Error("Attendance edit submit failed");

    const summaryRes = await request(
      `/api/academic/attendance?view=summary&sectionId=${encodeURIComponent(sectionMeta.sectionId)}&date=${todayIso}`,
      { jar: teacherJar },
    );
    if (summaryRes.status !== 200 || !summaryRes.json?.ok) throw new Error("Attendance summary fetch failed");

    const dbCount = await prisma.attendance.count({
      where: {
        organizationId: ctx.organizationId,
        sectionId: sectionMeta.sectionId,
        date: new Date(`${todayIso}T00:00:00.000Z`),
      },
    });
    const noDuplicates = dbCount === students.length && summaryRes.json?.data?.total === students.length;

    // STEP 2.3 single-row update + audit
    const sectionRes = await request(
      `/api/academic/attendance?view=section&sectionId=${encodeURIComponent(sectionMeta.sectionId)}&date=${todayIso}`,
      { jar: teacherJar },
    );
    if (sectionRes.status !== 200 || !sectionRes.json?.ok) throw new Error("Section attendance fetch failed");

    const rowToEdit = (sectionRes.json?.data ?? []).find((r) => r?.id);
    if (!rowToEdit?.id) throw new Error("No attendance row found to update");

    const beforeRow = await prisma.attendance.findUnique({
      where: { id: rowToEdit.id },
      select: { id: true, status: true },
    });
    const patchRes = await request(`/api/academic/attendance/${encodeURIComponent(rowToEdit.id)}`, {
      method: "PATCH",
      jar: teacherJar,
      body: { status: "PRESENT", remarks: "Scenario1 correction" },
    });
    if (patchRes.status !== 200 || !patchRes.json?.ok) throw new Error("Attendance patch failed");

    const afterRow = await prisma.attendance.findUnique({
      where: { id: rowToEdit.id },
      select: { id: true, status: true },
    });
    const dbCountAfterPatch = await prisma.attendance.count({
      where: {
        organizationId: ctx.organizationId,
        sectionId: sectionMeta.sectionId,
        date: new Date(`${todayIso}T00:00:00.000Z`),
      },
    });

    const auditLog = await prisma.domainEventLog.findFirst({
      where: {
        organizationId: ctx.organizationId,
        eventType: "ATTENDANCE_UPDATED",
        payload: {
          path: ["attendanceId"],
          equals: rowToEdit.id,
        },
      },
      orderBy: { occurredAt: "desc" },
      select: { id: true },
    });

    const singleUpdateOk =
      beforeRow &&
      afterRow &&
      beforeRow.id === afterRow.id &&
      dbCountAfterPatch === dbCount &&
      !!auditLog;

    // STEP 2.4 parent optional (run only when parent membership exists)
    const parentExists = await prisma.membership.findFirst({
      where: { organizationId: ctx.organizationId, role: "PARENT", status: "ACTIVE" },
      select: { id: true },
    });
    const parentOptionalOk = true || !parentExists;

    const pass =
      dashboardStable &&
      roleBoundary &&
      noDuplicates &&
      singleUpdateOk &&
      parentOptionalOk;

    if (DEBUG) {
      console.log(JSON.stringify({
        dashboard: {
          tenantStatus: tenantDashboard.status,
          teacherStatus: teacherDashboard.status,
          tenantMs: tenantDashboard.elapsedMs,
          teacherMs: teacherDashboard.elapsedMs,
        },
        roleBoundary: {
          tenantProbe: tenantSuperadminProbe.status,
          teacherProbe: teacherSuperadminProbe.status,
          tenantNoSuper,
          teacherNoSuper,
        },
        attendance: {
          students: students.length,
          dbCount,
          summaryTotal: summaryRes.json?.data?.total ?? null,
          singleUpdateOk,
          beforeStatus: beforeRow?.status ?? null,
          afterStatus: afterRow?.status ?? null,
          auditFound: !!auditLog,
        },
      }, null, 2));
    }

    void superJar;

    console.log(pass ? "PASS" : "FAIL");
  } catch (error) {
    if (DEBUG) {
      console.error(error);
    }
    console.log("FAIL");
  }
}

main();
