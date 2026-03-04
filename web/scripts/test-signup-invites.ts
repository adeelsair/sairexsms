/**
 * SAIREX SMS — Signup & Invite System Test Suite
 * Tests: public org signup, invite flow, admin users API, UI pages
 *
 * Run: npx tsx scripts/test-signup-invites.ts
 */

const BASE = "http://localhost:3000";
const UNIQUE = Date.now();

type TestResult = { name: string; pass: boolean; detail: string };
const results: TestResult[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
}

async function getSessionCookie(
  email: string,
  password: string
): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie?.() || [];

  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: new URLSearchParams({ csrfToken, email, password }),
    redirect: "manual",
  });

  const signInCookies = signInRes.headers.getSetCookie?.() || [];
  const allCookies = [...cookies, ...signInCookies];
  const cookieMap = new Map<string, string>();
  for (const c of allCookies) {
    const [nameVal] = c.split(";");
    const [name, ...valParts] = nameVal.split("=");
    cookieMap.set(name.trim(), valParts.join("=").trim());
  }
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function main() {
  console.log("==============================================");
  console.log("  SAIREX SMS — Signup & Invite Test Suite");
  console.log("==============================================\n");

  // ═══ PHASE 1: Public Signup (New Org) ═══
  console.log("Phase 1: Public Org Signup...");

  // 1a. Missing fields → 400
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@x.com", password: "Pass@123" }),
    });
    record("Signup — missing org fields → 400", res.status === 400, `status: ${res.status}`);
  }

  // 1b. Short password → 400
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@x.com",
        password: "short",
        orgName: "Test",
        orgCode: "T",
      }),
    });
    record("Signup — short password → 400", res.status === 400, `status: ${res.status}`);
  }

  // 1c. Success: Create new org + user
  const newOrgEmail = `testadmin-${UNIQUE}@test.com`;
  const newOrgCode = `TEST-${UNIQUE}`;
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newOrgEmail,
        password: "TestPass@123",
        orgName: `Test School ${UNIQUE}`,
        orgCode: newOrgCode,
      }),
    });
    const data = await res.json();
    record(
      "Signup — new org → 201",
      res.status === 201 && data.user?.role === "ORG_ADMIN",
      `status: ${res.status}, role: ${data.user?.role}, org: ${data.organizationName}`
    );
  }

  // 1d. Duplicate email → 409
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newOrgEmail,
        password: "TestPass@123",
        orgName: "Another Org",
        orgCode: `DUPE-${UNIQUE}`,
      }),
    });
    record("Signup — duplicate email → 409", res.status === 409, `status: ${res.status}`);
  }

  // 1e. Duplicate org code → 409
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `other-${UNIQUE}@test.com`,
        password: "TestPass@123",
        orgName: "Another Name",
        orgCode: newOrgCode,
      }),
    });
    record("Signup — duplicate orgCode → 409", res.status === 409, `status: ${res.status}`);
  }

  // 1f. Can login with new account
  {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    const cookies = csrfRes.headers.getSetCookie?.() || [];

    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({
        csrfToken,
        email: newOrgEmail,
        password: "TestPass@123",
      }),
      redirect: "manual",
    });
    record("Signup user can login → 302", res.status === 302, `status: ${res.status}`);
  }

  // ═══ PHASE 2: Invite System ═══
  console.log("Phase 2: Invite System...");

  const adminCookie = await getSessionCookie("admin@sairex-sms.com", "Admin@123");

  // 2a. Invites API — no auth → 401
  {
    const res = await fetch(`${BASE}/api/invites`);
    record("Invites GET — no auth → 401", res.status === 401, `status: ${res.status}`);
  }

  // 2b. Invites API — auth'd → 200
  {
    const res = await fetch(`${BASE}/api/invites`, {
      headers: { Cookie: adminCookie },
    });
    const data = await res.json();
    record(
      "Invites GET — auth'd → 200 with users",
      res.status === 200 && Array.isArray(data.users),
      `status: ${res.status}, users: ${data.users?.length}`
    );
  }

  // 2c. Send invite — missing fields → 400
  {
    const res = await fetch(`${BASE}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: "x@x.com" }),
    });
    record("Send invite — no role → 400", res.status === 400, `status: ${res.status}`);
  }

  // 2d. Send invite — invalid role → 400
  {
    const res = await fetch(`${BASE}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: "x@x.com", role: "SUPER_ADMIN" }),
    });
    record("Send invite — SUPER_ADMIN role → 400", res.status === 400, `status: ${res.status}`);
  }

  // 2e. Send invite — success
  const invitedEmail = `invited-${UNIQUE}@test.com`;
  let inviteToken = "";
  {
    const res = await fetch(`${BASE}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: invitedEmail, role: "TEACHER" }),
    });
    const data = await res.json();
    inviteToken = data.inviteUrl?.split("invite=")[1] || "";
    record(
      "Send invite — success → 201",
      res.status === 201 && !!inviteToken,
      `status: ${res.status}, token: ${inviteToken ? "received" : "missing"}`
    );
  }

  // 2f. Validate invite → 200
  {
    const res = await fetch(`${BASE}/api/invites/validate?token=${inviteToken}`);
    const data = await res.json();
    record(
      "Validate invite → 200 with email + role",
      res.status === 200 && data.email === invitedEmail && data.role === "TEACHER",
      `status: ${res.status}, email: ${data.email}, role: ${data.role}`
    );
  }

  // 2g. Validate invite — bad token → 404
  {
    const res = await fetch(`${BASE}/api/invites/validate?token=bogus-token`);
    record("Validate bad token → 404", res.status === 404, `status: ${res.status}`);
  }

  // ═══ PHASE 3: Invited User Signup ═══
  console.log("Phase 3: Invited User Signup...");

  // 3a. Signup with invite — wrong email → 403
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "wrong@email.com",
        password: "Teacher@123",
        inviteToken,
      }),
    });
    record("Invite signup — wrong email → 403", res.status === 403, `status: ${res.status}`);
  }

  // 3b. Signup with invite — success
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invitedEmail,
        password: "Teacher@123",
        inviteToken,
      }),
    });
    const data = await res.json();
    record(
      "Invite signup — success → 201 as TEACHER",
      res.status === 201 && data.user?.role === "TEACHER",
      `status: ${res.status}, role: ${data.user?.role}`
    );
  }

  // 3c. Signup with same invite → 400 (already used)
  {
    const res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invitedEmail,
        password: "Teacher@123",
        inviteToken,
      }),
    });
    record("Invite reuse → 400 (used)", res.status === 400 || res.status === 409, `status: ${res.status}`);
  }

  // 3d. Invited user can login
  {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    const cookies = csrfRes.headers.getSetCookie?.() || [];

    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({
        csrfToken,
        email: invitedEmail,
        password: "Teacher@123",
      }),
      redirect: "manual",
    });
    record("Invited user can login → 302", res.status === 302, `status: ${res.status}`);
  }

  // ═══ PHASE 4: UI Pages ═══
  console.log("Phase 4: UI Pages...");

  {
    const res = await fetch(`${BASE}/signup`, { redirect: "manual" });
    record("Signup page loads → 200", res.status === 200, `status: ${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/signup?invite=fake`, { redirect: "manual" });
    record("Signup page with invite loads → 200", res.status === 200, `status: ${res.status}`);
  }

  // ═══ PRINT RESULTS ═══
  console.log("\n==============================================");
  console.log("  TEST RESULTS");
  console.log("==============================================\n");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  ${icon} | ${r.name}`);
    if (!r.pass) console.log(`       Detail: ${r.detail}`);
    if (r.pass) passed++;
    else failed++;
  }

  console.log("\n----------------------------------------------");
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("----------------------------------------------");

  if (failed === 0) {
    console.log("\n  ALL TESTS PASSED!\n");
  } else {
    console.log(`\n  ${failed} TEST(S) FAILED — see details above.\n`);
  }
}

main();
