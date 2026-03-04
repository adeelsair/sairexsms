const { PrismaClient } = require("../lib/generated/prisma");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@sairex-sms.com";
const PASSWORD = "Admin@123";

function loadDatabaseUrlFromEnvLocal() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let value = trimmed.slice(eq + 1).trim();
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

loadDatabaseUrlFromEnvLocal();

class CookieJar {
  constructor() {
    this.map = new Map();
  }

  addFromResponse(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const [nameValue] = raw.split(";");
      const [name, ...valueParts] = nameValue.split("=");
      if (!name) continue;
      this.map.set(name.trim(), valueParts.join("=").trim());
    }
  }

  header() {
    return Array.from(this.map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

async function requestJson(path, { method = "GET", body, jar, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (jar) {
    const cookie = jar.header();
    if (cookie) reqHeaders.Cookie = cookie;
  }
  if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  if (jar) jar.addFromResponse(res);

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, data };
}

async function signInAndGetJar() {
  const jar = new CookieJar();

  const csrf = await requestJson("/api/auth/csrf", { jar });
  const csrfToken = csrf.data?.csrfToken;
  if (!csrfToken) throw new Error("Missing csrfToken");

  const form = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
  });

  const signinRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: form.toString(),
    redirect: "manual",
  });
  jar.addFromResponse(signinRes);

  return jar;
}

function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value?.data?.tenants && Array.isArray(value.data.tenants)) return value.data.tenants;
  return [];
}

function eventCategory(eventType) {
  const t = String(eventType || "").toUpperCase();
  if (t.includes("ATTEND")) return "attendance";
  if (t.includes("ENROLL") || t.includes("ADMISSION") || t.includes("STUDENT")) return "admission";
  if (t.includes("CHALLAN")) return "challan";
  if (t.includes("RECONC") || t.includes("PAYMENT")) return "payment";
  return null;
}

async function main() {
  const prisma = new PrismaClient();
  const debug = process.env.DEBUG_BLOCK_A === "1";
  try {
    const jar = await signInAndGetJar();

    const preSession = await requestJson("/api/auth/session", { jar });
    const superAdminId = Number(preSession.data?.user?.id ?? 0);
    if (!superAdminId) {
      if (debug) console.log("DEBUG", { step: "session", preSession });
      console.log("FAIL");
      return;
    }

    const tenantsRes = await requestJson("/api/superadmin/impersonate", { jar });
    const tenants = listFrom(tenantsRes.data);
    if (!tenants.length) {
      if (debug) console.log("DEBUG", { step: "tenants", tenantsRes });
      console.log("FAIL");
      return;
    }
    const targetTenantId = tenants[0].id;

    const start = await requestJson("/api/superadmin/impersonate", {
      method: "POST",
      jar,
      body: { targetId: targetTenantId },
    });
    const impersonationToken = start.data?.data?.impersonationToken;
    if (!impersonationToken) {
      if (debug) console.log("DEBUG", { step: "startImpersonation", start });
      console.log("FAIL");
      return;
    }

    const csrf2 = await requestJson("/api/auth/csrf", { jar });
    const update = await requestJson("/api/auth/session", {
      method: "POST",
      jar,
      body: {
        csrfToken: csrf2.data?.csrfToken,
        data: { impersonationToken },
      },
    });
    if (update.status !== 200) {
      if (debug) console.log("DEBUG", { step: "sessionUpdate", update });
      console.log("FAIL");
      return;
    }

    const postSession = await requestJson("/api/auth/session", { jar });
    if (!postSession.data?.user?.impersonation) {
      if (debug) console.log("DEBUG", { step: "postSession", postSession });
      console.log("FAIL");
      return;
    }

    const t0 = new Date();

    // Fetch class/section/student context for mobile actions.
    const classesRes = await requestJson("/api/mobile/attendance/classes", { jar });
    const classes = listFrom(classesRes.data);
    const firstClass = classes[0];
    if (!firstClass?.classId || !firstClass?.sectionId) {
      if (debug) console.log("DEBUG", { step: "classes", classesRes });
      console.log("FAIL");
      return;
    }

    let studentsRes = await requestJson(
      `/api/mobile/attendance/students?sectionId=${encodeURIComponent(firstClass.sectionId)}`,
      { jar },
    );
    let students = listFrom(studentsRes.data?.students ?? studentsRes.data);
    if (!students[0]?.studentId) {
      const seedStudent = await requestJson("/api/students", {
        method: "POST",
        jar,
        body: {
          fullName: `Seed ${Date.now()}`,
          admissionNo: `SEED-${Date.now()}`,
          grade: firstClass.className ?? "Grade",
          campusId: firstClass.campusId,
        },
      });
      const seedStudentId = seedStudent.data?.id;
      if (seedStudentId) {
        await requestJson("/api/academic/enrollments", {
          method: "POST",
          jar,
          body: {
            studentId: seedStudentId,
            campusId: firstClass.campusId,
            classId: firstClass.classId,
            sectionId: firstClass.sectionId,
          },
        });
      }
      studentsRes = await requestJson(
        `/api/mobile/attendance/students?sectionId=${encodeURIComponent(firstClass.sectionId)}`,
        { jar },
      );
      students = listFrom(studentsRes.data?.students ?? studentsRes.data);
    }
    const firstStudent = students[0];
    if (!firstStudent?.studentId) {
      if (debug) console.log("DEBUG", { step: "students", studentsRes });
      console.log("FAIL");
      return;
    }

    // 1) Attendance (server route that writes DomainEventLog)
    const attendanceDate = new Date().toISOString().slice(0, 10);
    const sectionStudentRows = listFrom(studentsRes.data?.students ?? studentsRes.data);
    const attendanceEntries = sectionStudentRows.slice(0, 10).map((row) => ({
      enrollmentId: row.enrollmentId,
      studentId: row.studentId,
      status: "PRESENT",
    }));
    const attendance = await requestJson("/api/academic/attendance", {
      method: "POST",
      jar,
      body: {
        academicYearId: firstClass.academicYearId,
        campusId: firstClass.campusId,
        classId: firstClass.classId,
        sectionId: firstClass.sectionId,
        date: attendanceDate,
        entries: attendanceEntries,
      },
    });

    // 2) Admission: create student then enroll to trigger StudentEnrolled event.
    const createdStudent = await requestJson("/api/students", {
      method: "POST",
      jar,
      body: {
        fullName: `Audit ${Date.now()}`,
        admissionNo: `AUD-${Date.now()}`,
        grade: firstClass.className ?? "Grade",
        campusId: firstClass.campusId,
      },
    });
    const newStudentId = createdStudent.data?.id;
    const admission = newStudentId
      ? await requestJson("/api/academic/enrollments", {
          method: "POST",
          jar,
          body: {
            studentId: newStudentId,
            campusId: firstClass.campusId,
            classId: firstClass.classId,
            sectionId: firstClass.sectionId,
          },
        })
      : { status: 400, data: null };
    const paymentStudentId = newStudentId ?? firstStudent.studentId;

    // 3) Challan (server route that writes DomainEventLog)
    const feeHeadRes = await requestJson("/api/finance/heads", {
      method: "POST",
      jar,
      body: {
        name: `Auto Head ${Date.now()}`,
        type: "RECURRING",
      },
    });
    const feeHeadId = feeHeadRes.data?.id;
    if (feeHeadId) {
      await requestJson("/api/finance/structures", {
        method: "POST",
        jar,
        body: {
          name: `Auto Structure ${Date.now()}`,
          amount: "1000",
          frequency: "MONTHLY",
          applicableGrade: firstClass.className ?? null,
          campusId: firstClass.campusId,
          feeHeadId,
        },
      });
    }

    const now = new Date();
    const billingToken = `T${Date.now().toString(36).toUpperCase()}`;
    const challan = await requestJson("/api/finance/challans", {
      method: "POST",
      jar,
      body: {
        campusId: firstClass.campusId,
        targetGrade: firstClass.className ?? "Grade",
        billingMonth: billingToken,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const challansList = await requestJson("/api/finance/challans", { jar });
    const createdChallan = listFrom(challansList.data).find(
      (row) => row?.studentId === paymentStudentId && String(row?.challanNo || "").includes(billingToken.slice(0, 3)),
    ) ?? listFrom(challansList.data).find((row) => row?.studentId === paymentStudentId && row?.status === "UNPAID");
    const createdChallanId = createdChallan?.id ?? null;

    // 4) Fee collection
    const feeCollection = createdChallanId
      ? await requestJson("/api/finance/payments", {
          method: "POST",
          jar,
          body: {
            challanId: createdChallanId,
            amount: 1,
            paymentDate: new Date().toISOString(),
            paymentMethod: "OTC",
            referenceNumber: `F-${Date.now()}`,
          },
        })
      : { status: 400, data: null };

    // 5) Reconciliation (second explicit payment event on separate challan)
    const billingToken2 = `U${Date.now().toString(36).toUpperCase()}`;
    const challan2 = await requestJson("/api/finance/challans", {
      method: "POST",
      jar,
      body: {
        campusId: firstClass.campusId,
        targetGrade: firstClass.className ?? "Grade",
        billingMonth: billingToken2,
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const challansList2 = await requestJson("/api/finance/challans", { jar });
    const secondChallan = listFrom(challansList2.data).find(
      (row) => row?.studentId === paymentStudentId && String(row?.challanNo || "").includes(billingToken2.slice(0, 3)),
    );
    const secondChallanId = secondChallan?.id ?? null;

    const reconciliation = secondChallanId
      ? await requestJson("/api/finance/payments", {
      method: "POST",
      jar,
      body: {
            challanId: secondChallanId,
            amount: 1,
            paymentDate: new Date().toISOString(),
            paymentMethod: "OTC",
            referenceNumber: `R-${Date.now()}`,
      },
        })
      : { status: 400, data: null };

    const calls = [attendance, admission, challan, feeCollection, reconciliation];
    const allCallsOk = calls.every((c) => c.status >= 200 && c.status < 300);
    if (!allCallsOk) {
      if (debug) {
        console.log("DEBUG", {
          step: "actions",
          attendance,
          admission,
          challan,
          feeCollection,
          reconciliation,
        });
      }
      console.log("FAIL");
      return;
    }

    const rows = await prisma.domainEventLog.findMany({
      where: {
        createdAt: { gte: t0 },
        organizationId: targetTenantId,
        payload: {
          path: ["_audit", "impersonation"],
          equals: true,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        eventType: true,
        payload: true,
      },
    });

    const needed = new Set([
      "attendance",
      "admission",
      "challan",
      "payment",
    ]);
    const seen = new Set();
    let paymentEventsSeen = 0;
    let lineageOk = true;

    for (const row of rows) {
      const category = eventCategory(row.eventType);
      if (!category || !needed.has(category)) continue;

      const payload = row.payload && typeof row.payload === "object"
        ? row.payload
        : {};
      const audit = payload && payload._audit && typeof payload._audit === "object"
        ? payload._audit
        : {};

      const actorUserId = Number(audit.actorUserId ?? 0);
      const effectiveUserId = Number(audit.effectiveUserId ?? 0);
      const tenantId = String(audit.tenantId ?? "");
      const impersonation = Boolean(audit.impersonation);

      seen.add(category);
      if (category === "payment") {
        paymentEventsSeen += 1;
      }
      if (
        actorUserId !== superAdminId ||
        !effectiveUserId ||
        effectiveUserId === actorUserId ||
        tenantId !== targetTenantId ||
        !impersonation
      ) {
        lineageOk = false;
      }
    }

    const pass =
      lineageOk &&
      seen.size === needed.size &&
      paymentEventsSeen >= 2;
    if (!pass && debug) {
      console.log("DEBUG", {
        step: "lineage",
        superAdminId,
        targetTenantId,
        seen: Array.from(seen),
        paymentEventsSeen,
        rows: rows.slice(0, 20).map((row) => ({ eventType: row.eventType, payload: row.payload })),
      });
    }
    console.log(pass ? "PASS" : "FAIL");
  } catch (error) {
    if (debug) {
      console.log("DEBUG", { step: "exception", error: String(error) });
    }
    console.log("FAIL");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
