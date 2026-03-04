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
const DEBUG = process.env.DEBUG_SCENARIO2 === "1";

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

async function request(pathname, { method = "GET", jar, body } = {}) {
  const headers = {};
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers.Cookie = cookie;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const started = Date.now();
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
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

async function ensureScenarioUsers(prisma) {
  const superUser = await prisma.user.findUnique({
    where: { email: SUPER_EMAIL },
    select: { id: true },
  });
  if (!superUser) throw new Error("Super admin missing");

  const superMembership = await prisma.membership.findFirst({
    where: { userId: superUser.id, status: "ACTIVE" },
    orderBy: { id: "asc" },
    select: { organizationId: true },
  });
  if (!superMembership?.organizationId) throw new Error("No org context for super admin");

  const classRow = await prisma.class.findFirst({
    where: {
      organizationId: superMembership.organizationId,
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
  if (!classRow?.id || !classRow.sections[0]?.id) {
    throw new Error("No active class/section available");
  }

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
        organizationId: superMembership.organizationId,
      },
    },
    update: { role: "ORG_ADMIN", status: "ACTIVE", campusId: classRow.campusId },
    create: {
      userId: tenantUser.id,
      organizationId: superMembership.organizationId,
      role: "ORG_ADMIN",
      status: "ACTIVE",
      campusId: classRow.campusId,
    },
  });

  const teacherMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: teacherUser.id,
        organizationId: superMembership.organizationId,
      },
    },
    update: { role: "TEACHER", status: "ACTIVE", campusId: classRow.campusId },
    create: {
      userId: teacherUser.id,
      organizationId: superMembership.organizationId,
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
    organizationId: superMembership.organizationId,
    classId: classRow.id,
    className: classRow.name,
    campusId: classRow.campusId,
    academicYearId: classRow.academicYearId,
    sectionId: classRow.sections[0].id,
  };
}

async function ensureFeeStructureForGrade(tenantJar, classCtx) {
  const heads = await request("/api/finance/heads", { jar: tenantJar });
  let feeHeadId = null;
  if (Array.isArray(heads.json) && heads.json.length > 0) {
    feeHeadId = heads.json[0].id;
  }
  if (!feeHeadId) {
    const createHead = await request("/api/finance/heads", {
      method: "POST",
      jar: tenantJar,
      body: { name: `Scenario2 Head ${Date.now()}`, type: "RECURRING" },
    });
    feeHeadId = createHead.json?.id;
  }
  if (!feeHeadId) throw new Error("Unable to resolve fee head");

  const structures = await request("/api/finance/structures", { jar: tenantJar });
  const existing = Array.isArray(structures.json)
    ? structures.json.find((s) => s.campusId === classCtx.campusId && s.applicableGrade === classCtx.className)
    : null;
  if (existing) return existing.id;

  const createStructure = await request("/api/finance/structures", {
    method: "POST",
    jar: tenantJar,
    body: {
      name: `Scenario2 Structure ${Date.now()}`,
      amount: "1200",
      frequency: "MONTHLY",
      applicableGrade: classCtx.className,
      campusId: classCtx.campusId,
      feeHeadId,
    },
  });
  if (createStructure.status < 200 || createStructure.status >= 300) {
    throw new Error("Failed to create fee structure");
  }
  return createStructure.json?.id ?? null;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const ctx = await ensureScenarioUsers(prisma);
    const tenantAuth = await signIn(TENANT_EMAIL, DEFAULT_PASSWORD);
    const teacherAuth = await signIn(TEACHER_EMAIL, DEFAULT_PASSWORD);
    const tenantJar = tenantAuth.jar;
    const teacherJar = teacherAuth.jar;

    await ensureFeeStructureForGrade(tenantJar, ctx);

    // STEP 2.5 Quick admission flow (mobile quick-admission path).
    const quickAdmission = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ADD_STUDENT_QUICK",
        payload: {
          studentName: `Scenario2 Student ${Date.now()}`,
          fatherName: "Scenario Father",
          mobileNumber: "03001234567",
          classId: ctx.classId,
          organizationId: "ORG-INJECTION-TEST", // must be ignored
        },
      },
    });
    if (quickAdmission.status !== 200 || !quickAdmission.json?.result?.studentId) {
      throw new Error("Quick admission failed");
    }
    const newStudentId = quickAdmission.json.result.studentId;
    const admissionNo = quickAdmission.json.result.grNumber;

    const studentRecord = await prisma.student.findUnique({
      where: { id: newStudentId },
      select: {
        id: true,
        organizationId: true,
        fullName: true,
        admissionNo: true,
        grade: true,
        campusId: true,
      },
    });
    const admissionUniqueCount = await prisma.student.count({
      where: { admissionNo },
    });
    const studentInList = await request("/api/students", { jar: tenantJar });
    const listed =
      Array.isArray(studentInList.json) &&
      studentInList.json.some((s) => s.id === newStudentId);
    const feeStructureAttached = (await prisma.feeStructure.count({
      where: {
        organizationId: ctx.organizationId,
        campusId: ctx.campusId,
        isActive: true,
        OR: [{ applicableGrade: ctx.className }, { applicableGrade: null }, { applicableGrade: "" }],
      },
    })) > 0;

    // STEP 2.7 Generate challan for new student (needed before immediate fee collection).
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const issueChallanSingle = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ISSUE_CHALLAN",
        payload: { mode: "single", studentId: newStudentId, month, year },
      },
    });
    const generatedChallanIds = issueChallanSingle.json?.result?.challanIds ?? [];
    if (issueChallanSingle.status !== 200 || !generatedChallanIds.length) {
      throw new Error("Single challan generation failed");
    }
    const firstChallanId = generatedChallanIds[0];
    const firstChallan = await prisma.feeChallan.findUnique({
      where: { id: firstChallanId },
      select: { id: true, challanNo: true, totalAmount: true, paidAmount: true, organizationId: true },
    });
    if (!firstChallan) throw new Error("Generated challan not found");

    // STEP 2.6 Immediate fee collection for newly admitted student.
    const outstanding = Number(firstChallan.totalAmount) - Number(firstChallan.paidAmount);
    const collectAmount = Math.min(Math.max(outstanding, 1), 500);
    const collectFee = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "COLLECT_FEE",
        payload: {
          studentId: newStudentId,
          challanId: firstChallanId,
          amount: collectAmount,
        },
      },
    });
    if (collectFee.status !== 200 || !collectFee.json?.result?.paymentRecordId || !collectFee.json?.receiptNo) {
      throw new Error("Immediate fee collection failed");
    }
    const paymentRecordId = collectFee.json.result.paymentRecordId;

    const payment = await prisma.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      select: { id: true, challanId: true, amount: true, organizationId: true, status: true },
    });
    const ledger = await prisma.ledgerEntry.findFirst({
      where: {
        organizationId: ctx.organizationId,
        referenceType: "PaymentRecord",
        referenceId: paymentRecordId,
        entryType: "PAYMENT_RECEIVED",
      },
      select: { id: true, amount: true },
    });
    const summary = await prisma.studentFinancialSummary.findUnique({
      where: { studentId: newStudentId },
      select: { totalDebit: true, totalCredit: true, balance: true },
    });
    const financeMathOk =
      summary &&
      Number(summary.totalDebit) - Number(summary.totalCredit) === Number(summary.balance);

    // STEP 2.7 Generate challan for remaining dues (next month), ensure uniqueness.
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const issueChallanNext = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ISSUE_CHALLAN",
        payload: { mode: "single", studentId: newStudentId, month: nextMonth, year: nextYear },
      },
    });
    if (issueChallanNext.status !== 200 || !(issueChallanNext.json?.result?.challanIds ?? []).length) {
      throw new Error("Remaining-dues challan generation failed");
    }
    const duplicateChallanNumbers = await prisma.feeChallan.groupBy({
      by: ["challanNo"],
      _count: { challanNo: true },
      having: {
        challanNo: { _count: { gt: 1 } },
      },
    });

    // STEP 2.8 Mobile action flow.
    const teacherClasses = await request("/api/mobile/attendance/classes", { jar: teacherJar });
    const classRows = Array.isArray(teacherClasses.json) ? teacherClasses.json : [];
    const teacherClass = classRows.find((r) => r.sectionId === ctx.sectionId) ?? classRows[0];
    if (!teacherClass?.sectionId) throw new Error("Teacher class not available for mobile attendance");

    const studentsForAttendance = await request(
      `/api/mobile/attendance/students?sectionId=${encodeURIComponent(teacherClass.sectionId)}`,
      { jar: teacherJar },
    );
    const sectionStudents = studentsForAttendance.json?.students ?? [];
    if (!sectionStudents.length) throw new Error("No section students for mobile attendance");

    const markAttendance = await request("/api/mobile/action", {
      method: "POST",
      jar: teacherJar,
      body: {
        type: "MARK_ATTENDANCE",
        payload: {
          classId: teacherClass.classId,
          sectionId: teacherClass.sectionId,
          date: new Date().toISOString(),
          absentees: [sectionStudents[0].studentId],
        },
      },
    });

    // Permission leakage check: teacher cannot quick-admit.
    const teacherQuickAdmission = await request("/api/mobile/action", {
      method: "POST",
      jar: teacherJar,
      body: {
        type: "ADD_STUDENT_QUICK",
        payload: {
          studentName: "Leak Test",
          fatherName: "Leak Test",
          mobileNumber: "03001111111",
          classId: ctx.classId,
        },
      },
    });

    // Tenant guard bypass check: class from another org or invalid should never create cross-tenant write.
    const otherOrgClass = await prisma.class.findFirst({
      where: { organizationId: { not: ctx.organizationId } },
      select: { id: true },
    });
    const crossTenantAdmissionProbe = await request("/api/mobile/action", {
      method: "POST",
      jar: tenantJar,
      body: {
        type: "ADD_STUDENT_QUICK",
        payload: {
          studentName: "Cross Tenant Probe",
          fatherName: "Cross Tenant Probe",
          mobileNumber: "03009998888",
          classId: otherOrgClass?.id ?? "invalid-class-id",
        },
      },
    });

    const mobileFlowFast =
      collectFee.elapsedMs < 2000 &&
      issueChallanSingle.elapsedMs < 2000 &&
      markAttendance.elapsedMs < 2000;

    const pass =
      // Step 2.5 checks
      studentRecord &&
      studentRecord.organizationId === ctx.organizationId &&
      !!studentRecord.fullName &&
      !!studentRecord.admissionNo &&
      !!studentRecord.grade &&
      !!studentRecord.campusId &&
      admissionUniqueCount === 1 &&
      listed &&
      feeStructureAttached &&
      // Step 2.6 checks
      payment &&
      payment.organizationId === ctx.organizationId &&
      payment.status === "RECONCILED" &&
      ledger &&
      !!collectFee.json?.receiptNo &&
      !!financeMathOk &&
      Number(summary.balance) >= 0 &&
      // Step 2.7 checks
      duplicateChallanNumbers.length === 0 &&
      Number(firstChallan.totalAmount) > 0 &&
      // Step 2.8 checks
      markAttendance.status === 200 &&
      teacherQuickAdmission.status >= 400 &&
      crossTenantAdmissionProbe.status >= 400 &&
      mobileFlowFast;

    if (DEBUG) {
      console.log(JSON.stringify({
        timings: {
          quickAdmissionMs: quickAdmission.elapsedMs,
          collectFeeMs: collectFee.elapsedMs,
          challanSingleMs: issueChallanSingle.elapsedMs,
          markAttendanceMs: markAttendance.elapsedMs,
        },
        checks: {
          studentId: newStudentId,
          admissionUniqueCount,
          listed,
          feeStructureAttached,
          paymentRecordId,
          ledgerFound: !!ledger,
          receiptNo: collectFee.json?.receiptNo ?? null,
          summary: summary
            ? {
                totalDebit: Number(summary.totalDebit),
                totalCredit: Number(summary.totalCredit),
                balance: Number(summary.balance),
              }
            : null,
          duplicateChallanNumbers: duplicateChallanNumbers.length,
          teacherQuickAdmissionStatus: teacherQuickAdmission.status,
          crossTenantAdmissionProbeStatus: crossTenantAdmissionProbe.status,
          markAttendanceStatus: markAttendance.status,
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
