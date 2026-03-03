const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@sairex-sms.com";
const PASSWORD = "Admin@123";
const WAIT_MS = 70_000;

function ensureDbUrl() {
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
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const [nameValue] = raw.split(";");
      const [name, ...valueParts] = nameValue.split("=");
      if (!name) continue;
      this.map.set(name.trim(), valueParts.join("=").trim());
    }
  }
  header() {
    return Array.from(this.map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function requestJson(pathname, { method = "GET", body, jar } = {}) {
  const headers = {};
  const cookie = jar?.header();
  if (cookie) headers.Cookie = cookie;
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
  if (value?.data?.tenants && Array.isArray(value.data.tenants)) return value.data.tenants;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function signInJar() {
  const jar = new CookieJar();
  const csrf = await requestJson("/api/auth/csrf", { jar });
  const csrfToken = csrf.data?.csrfToken;
  if (!csrfToken) throw new Error("Missing CSRF");

  const form = new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD });
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: form.toString(),
    redirect: "manual",
  });
  jar.addFromResponse(res);
  return jar;
}

async function main() {
  ensureDbUrl();
  const prisma = new PrismaClient();
  try {
    const jar = await signInJar();

    const tenantsRes = await requestJson("/api/superadmin/impersonate", { jar });
    const tenants = listFrom(tenantsRes.data);
    if (!tenants.length) {
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
      console.log("FAIL");
      return;
    }

    const csrf2 = await requestJson("/api/auth/csrf", { jar });
    const update = await requestJson("/api/auth/session", {
      method: "POST",
      jar,
      body: { csrfToken: csrf2.data?.csrfToken, data: { impersonationToken } },
    });
    if (update.status !== 200) {
      console.log("FAIL");
      return;
    }

    const preExpirySession = await requestJson("/api/auth/session", { jar });
    if (!preExpirySession.data?.user?.impersonation) {
      console.log("FAIL");
      return;
    }

    const beforeCount = await prisma.domainEventLog.count({
      where: {
        organizationId: targetTenantId,
        eventType: { in: ["ATTENDANCE_BULK_MARKED", "ATTENDANCE_UPDATED", "PaymentReconciled", "ChallanCreated", "StudentEnrolled"] },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

    // Attempts after expiry
    const attendanceAttempt = await requestJson("/api/mobile/attendance/classes", { jar });
    const studentsAttempt = await requestJson("/api/mobile/students/classes", { jar });
    const anyTenantApiAttempt = await requestJson("/api/mobile/dashboard", { jar });

    const postExpirySession = await requestJson("/api/auth/session", { jar });
    const sessionInvalidated = !postExpirySession.data?.user;
    const blockedByAuth = [attendanceAttempt, studentsAttempt, anyTenantApiAttempt]
      .every((r) => r.status === 401 || r.status === 403);

    const afterCount = await prisma.domainEventLog.count({
      where: {
        organizationId: targetTenantId,
        eventType: { in: ["ATTENDANCE_BULK_MARKED", "ATTENDANCE_UPDATED", "PaymentReconciled", "ChallanCreated", "StudentEnrolled"] },
      },
    });

    const noActionExecuted = afterCount === beforeCount;
    const pass = sessionInvalidated && blockedByAuth && noActionExecuted;
    console.log(pass ? "PASS" : "FAIL");
  } catch {
    console.log("FAIL");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
