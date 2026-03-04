const puppeteer = require("puppeteer");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@sairex-sms.com";
const PASSWORD = "Admin@123";

function pickArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.tenants)) return payload.data.tenants;
  return [];
}

async function post(page, path, body) {
  return page.evaluate(
    async ({ pathArg, bodyArg }) => {
      const res = await fetch(pathArg, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyArg),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
    { pathArg: path, bodyArg: body },
  );
}

async function get(page, path) {
  return page.evaluate(
    async (pathArg) => {
      const res = await fetch(pathArg, {
        method: "GET",
        credentials: "include",
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
    path,
  );
}

function eventCategory(eventType) {
  const t = String(eventType || "").toUpperCase();
  if (t.includes("ATTEND")) return "attendance";
  if (t.includes("ADMISSION") || t.includes("STUDENT")) return "admission";
  if (t.includes("CHALLAN")) return "challan";
  if (t.includes("RECONC") || (t.includes("PAYMENT") && t.includes("RECORD"))) return "reconciliation";
  if (t.includes("PAYMENT") || t.includes("FEE_COLLECT")) return "fee";
  return null;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const prisma = new PrismaClient();
  let finalPass = false;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.type('input[type="email"]', EMAIL);
    await page.type('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null);

    // Capture original SA user id.
    const sessionBefore = await get(page, "/api/auth/session");
    const superAdminId = Number(sessionBefore?.data?.user?.id || 0);

    // Get tenant list and start impersonation using API + session update.
    const tenantsRes = await get(page, "/api/superadmin/impersonate");
    const tenants = pickArray(tenantsRes.data?.data || tenantsRes.data);
    if (!Array.isArray(tenants) || tenants.length === 0) {
      console.log("FAIL");
      return;
    }
    const targetTenantId = tenants[0].id;

    const startRes = await post(page, "/api/superadmin/impersonate", { targetId: targetTenantId });
    const token = startRes?.data?.data?.impersonationToken;
    if (!token) {
      console.log("FAIL");
      return;
    }

    const csrfRes = await get(page, "/api/auth/csrf");
    const csrfToken = csrfRes?.data?.csrfToken;
    if (!csrfToken) {
      console.log("FAIL");
      return;
    }

    const sessionUpdate = await page.evaluate(
      async ({ csrfTokenArg, tokenArg }) => {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csrfToken: csrfTokenArg,
            data: { impersonationToken: tokenArg },
          }),
        });
        return res.status;
      },
      { csrfTokenArg: csrfToken, tokenArg: token },
    );
    if (sessionUpdate !== 200) {
      console.log("FAIL");
      return;
    }

    const sessionAfter = await get(page, "/api/auth/session");
    const impersonationActive = Boolean(sessionAfter?.data?.user?.impersonation);
    if (!impersonationActive) {
      console.log("FAIL");
      return;
    }

    const t0 = new Date();

    // Resolve class/section/student context
    const classesRes = await get(page, "/api/mobile/attendance/classes");
    const classes = pickArray(classesRes.data);
    const firstClass = classes[0];
    if (!firstClass?.sectionId || !firstClass?.classId) {
      console.log("FAIL");
      return;
    }

    const studentsRes = await get(page, `/api/mobile/attendance/students?sectionId=${encodeURIComponent(firstClass.sectionId)}`);
    const students = pickArray(studentsRes.data?.students ? studentsRes.data.students : studentsRes.data);
    const firstStudent = students[0];
    if (!firstStudent?.studentId) {
      console.log("FAIL");
      return;
    }

    // 1) Attendance
    const attendanceRes = await post(page, "/api/mobile/action", {
      type: "MARK_ATTENDANCE",
      payload: {
        classId: firstClass.classId,
        sectionId: firstClass.sectionId,
        date: new Date().toISOString().slice(0, 10),
        absentees: [],
      },
    });

    // 2) Admission
    const admissionRes = await post(page, "/api/mobile/action", {
      type: "ADD_STUDENT_QUICK",
      payload: {
        studentName: `Audit Test ${Date.now()}`,
        fatherName: "Runtime Check",
        mobileNumber: "+923001112233",
        classId: firstClass.classId,
      },
    });

    // 3) Challan
    const now = new Date();
    const challanRes = await post(page, "/api/mobile/action", {
      type: "ISSUE_CHALLAN",
      payload: {
        mode: "single",
        studentId: firstStudent.studentId,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
      },
    });
    const generatedChallanId = challanRes?.data?.result?.challanIds?.[0];

    // 4) Fee collection
    const feeCollectRes = await post(page, "/api/mobile/action", {
      type: "COLLECT_FEE",
      payload: {
        studentId: firstStudent.studentId,
        challanId: generatedChallanId,
        amount: 1,
      },
    });

    // 5) Reconciliation (explicit)
    const reconciliationRes = generatedChallanId
      ? await post(page, "/api/finance/payments", {
          challanId: generatedChallanId,
          amount: 1,
          paymentDate: new Date().toISOString(),
          paymentMethod: "OTC",
          referenceNumber: `A-${Date.now()}`,
        })
      : { status: 400, data: null };

    const actionCallsOk = [attendanceRes, admissionRes, challanRes, feeCollectRes, reconciliationRes]
      .every((r) => r.status >= 200 && r.status < 300);
    if (!actionCallsOk) {
      console.log("FAIL");
      return;
    }

    // DB verification
    const rows = await prisma.domainEventLog.findMany({
      where: {
        createdAt: { gte: t0 },
        payload: {
          path: ["_audit", "impersonation"],
          equals: true,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        eventType: true,
        payload: true,
        organizationId: true,
      },
    });

    const required = new Set(["attendance", "admission", "challan", "fee", "reconciliation"]);
    const matched = new Set();
    let lineageOk = true;

    for (const row of rows) {
      const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
      const audit = payload && payload._audit && typeof payload._audit === "object" ? payload._audit : {};

      const category = eventCategory(row.eventType);
      if (!category) continue;
      if (!required.has(category)) continue;
      matched.add(category);

      const actorUserId = Number(audit.actorUserId ?? 0);
      const effectiveUserId = Number(audit.effectiveUserId ?? 0);
      const tenantId = String(audit.tenantId ?? "");
      const impersonation = Boolean(audit.impersonation);

      if (
        actorUserId !== superAdminId ||
        !effectiveUserId ||
        effectiveUserId === actorUserId ||
        !impersonation ||
        tenantId !== targetTenantId ||
        row.organizationId !== targetTenantId
      ) {
        lineageOk = false;
      }
    }

    finalPass = lineageOk && matched.size === required.size;
    console.log(finalPass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  } finally {
    await prisma.$disconnect().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main();
