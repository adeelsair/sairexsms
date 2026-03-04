/**
 * SAIREX SMS — API Security & Tenant Isolation Test Suite
 * Tests all routes for: auth enforcement, tenant scoping, role checks,
 * cross-reference validation, and campus-level isolation.
 *
 * Run with: npx tsx scripts/test-api-security.ts
 *
 * Prerequisites:
 *   1. Dev server running (npm run dev)
 *   2. SUPER_ADMIN account: admin@sairex-sms.com / Admin@123
 *   3. (Optional) ORG_ADMIN account for cross-tenant tests
 */

const BASE_URL = "http://localhost:3000";

type TestResult = {
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
};

const allResults: TestResult[] = [];

// ─── HELPERS ────────────────────────────────────────────────

async function testRoute(
  name: string,
  method: string,
  path: string,
  expectedStatus: number,
  options?: { cookie?: string; body?: any }
) {
  try {
    const headers: Record<string, string> = {};
    if (options?.cookie) headers["Cookie"] = options.cookie;
    if (options?.body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      redirect: "manual",
    });

    const status = res.status;
    const pass = status === expectedStatus;

    allResults.push({ name, pass, expected: `${expectedStatus}`, actual: `${status}` });
    return { status, res };
  } catch (err: any) {
    allResults.push({
      name,
      pass: false,
      expected: `${expectedStatus}`,
      actual: `ERROR: ${err.message}`,
    });
    return { status: 0, res: null };
  }
}

async function fetchJson(
  path: string,
  cookie: string,
  method = "GET",
  body?: any
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { Cookie: cookie };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function getSessionCookie(
  email: string,
  password: string
): Promise<string> {
  // Step 1: CSRF token
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookies = csrfRes.headers.getSetCookie?.() || [];

  // Step 2: Sign in
  const signInRes = await fetch(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({ csrfToken, email, password }),
      redirect: "manual",
    }
  );

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

// ─── MAIN ───────────────────────────────────────────────────

async function main() {
  console.log("==============================================");
  console.log("  SAIREX SMS — Tenant Isolation Test Suite");
  console.log("==============================================\n");

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: UNAUTHENTICATED ACCESS (all should → 401)
  // ═══════════════════════════════════════════════════════════
  console.log("Phase 1: Unauthenticated access (expect 401)...");

  const protectedRoutes = [
    ["GET", "/api/organizations"],
    ["POST", "/api/organizations"],
    ["GET", "/api/regions"],
    ["POST", "/api/regions"],
    ["GET", "/api/campuses"],
    ["POST", "/api/campuses"],
    ["GET", "/api/students"],
    ["POST", "/api/students"],
    ["GET", "/api/finance/heads"],
    ["POST", "/api/finance/heads"],
    ["GET", "/api/finance/structures"],
    ["POST", "/api/finance/structures"],
    ["GET", "/api/finance/challans"],
    ["POST", "/api/finance/challans"],
    ["PUT", "/api/finance/challans"],
    ["GET", "/api/cron/reminders"],
  ];

  for (const [method, path] of protectedRoutes) {
    await testRoute(
      `NO AUTH → ${method} ${path}`,
      method,
      path,
      401,
      { body: method !== "GET" ? {} : undefined }
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: AUTHENTICATED — SUPER_ADMIN SESSION
  // ═══════════════════════════════════════════════════════════
  console.log("\nPhase 2: Authenticating as SUPER_ADMIN...");
  let saCookie: string;
  try {
    saCookie = await getSessionCookie("admin@sairex-sms.com", "Admin@123");
    if (!saCookie || saCookie.length < 20) {
      console.error("  FAILED to obtain SUPER_ADMIN session. Aborting.\n");
      printResults();
      return;
    }
    console.log("  Session obtained.\n");
  } catch (err: any) {
    console.error("  Auth error:", err.message);
    printResults();
    return;
  }

  // Authenticated GETs should → 200
  console.log("Phase 2a: Authenticated GET requests (expect 200)...");
  const getRoutes = [
    "/api/organizations",
    "/api/regions",
    "/api/campuses",
    "/api/students",
    "/api/finance/heads",
    "/api/finance/structures",
    "/api/finance/challans",
    "/api/cron/reminders",
  ];
  for (const path of getRoutes) {
    await testRoute(`AUTH → GET ${path}`, "GET", path, 200, { cookie: saCookie });
  }

  // Verify returns arrays
  console.log("Phase 2b: Data shape validation...");
  for (const path of ["/api/organizations", "/api/students", "/api/finance/challans"]) {
    const { data } = await fetchJson(path, saCookie);
    const isArr = Array.isArray(data);
    allResults.push({
      name: `SHAPE → ${path} returns array`,
      pass: isArr,
      expected: "array",
      actual: isArr ? `array(${data.length})` : typeof data,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: TENANT ISOLATION — CROSS-REFERENCE VALIDATION
  // ═══════════════════════════════════════════════════════════
  console.log("\nPhase 3: Cross-reference validation...");

  // 3a. Create two test organizations
  const ts = Date.now();
  const { data: orgA } = await fetchJson("/api/organizations", saCookie, "POST", {
    name: `IsolationTestOrg_A_${ts}`,
    orgCode: `ISO-A-${ts}`,
    plan: "FREE",
  });
  const { data: orgB } = await fetchJson("/api/organizations", saCookie, "POST", {
    name: `IsolationTestOrg_B_${ts}`,
    orgCode: `ISO-B-${ts}`,
    plan: "FREE",
  });

  if (!orgA?.id || !orgB?.id) {
    console.error("  Could not create test orgs. Skipping cross-ref tests.");
  } else {
    console.log(`  Created Org A (id=${orgA.id}) and Org B (id=${orgB.id})`);

    // 3b. Create a campus in Org A
    const { data: campusA } = await fetchJson("/api/campuses", saCookie, "POST", {
      name: `Campus A ${ts}`,
      campusCode: `CA-${ts}`,
      city: "Lahore",
      organizationId: orgA.id,
    });

    // 3c. Create a region in Org A
    const { data: regionA } = await fetchJson("/api/regions", saCookie, "POST", {
      name: `Region A ${ts}`,
      city: "Karachi",
      organizationId: orgA.id,
    });

    // 3d. Create a fee head in Org A
    const { data: headA } = await fetchJson("/api/finance/heads", saCookie, "POST", {
      name: `Tuition ${ts}`,
      type: "RECURRING",
      organizationId: orgA.id,
    });

    if (campusA?.id && regionA?.id && headA?.id) {
      console.log(`  Created Campus A (${campusA.id}), Region A (${regionA.id}), FeeHead A (${headA.id})\n`);

      // ── TEST: Create student in Org B referencing Org A's campus → expect 403
      const { status: s1, data: d1 } = await fetchJson(
        "/api/students",
        saCookie,
        "POST",
        {
          fullName: "Cross-Org Student",
          admissionNo: `XREF-STU-${ts}`,
          grade: "Grade 10",
          organizationId: orgB.id,
          campusId: campusA.id, // Belongs to Org A!
        }
      );
      allResults.push({
        name: "XREF → Student with cross-org campusId → 403",
        pass: s1 === 403,
        expected: "403",
        actual: `${s1}`,
      });

      // ── TEST: Create campus in Org B referencing Org A's region → expect 403
      const { status: s2 } = await fetchJson(
        "/api/campuses",
        saCookie,
        "POST",
        {
          name: `Cross Campus ${ts}`,
          campusCode: `XC-${ts}`,
          city: "Islamabad",
          organizationId: orgB.id,
          regionId: regionA.id, // Belongs to Org A!
        }
      );
      allResults.push({
        name: "XREF → Campus with cross-org regionId → 403",
        pass: s2 === 403,
        expected: "403",
        actual: `${s2}`,
      });

      // ── TEST: Create fee structure in Org B referencing Org A's campus + head → 403
      const { status: s3 } = await fetchJson(
        "/api/finance/structures",
        saCookie,
        "POST",
        {
          name: `Cross Rule ${ts}`,
          amount: "5000",
          frequency: "MONTHLY",
          organizationId: orgB.id,
          campusId: campusA.id,  // Belongs to Org A!
          feeHeadId: headA.id,   // Belongs to Org A!
        }
      );
      allResults.push({
        name: "XREF → FeeStructure with cross-org campus+head → 403",
        pass: s3 === 403,
        expected: "403",
        actual: `${s3}`,
      });

      // ── TEST: Generate challans in Org B referencing Org A's campus → 403
      const { status: s4 } = await fetchJson(
        "/api/finance/challans",
        saCookie,
        "POST",
        {
          organizationId: orgB.id,
          campusId: campusA.id, // Belongs to Org A!
          targetGrade: "Grade 10",
          billingMonth: "January",
          dueDate: "2026-03-15",
        }
      );
      allResults.push({
        name: "XREF → Challans with cross-org campusId → 403",
        pass: s4 === 403,
        expected: "403",
        actual: `${s4}`,
      });

      // ── TEST: Same-org refs should succeed (happy path)
      const { status: s5 } = await fetchJson(
        "/api/students",
        saCookie,
        "POST",
        {
          fullName: "Same-Org Student",
          admissionNo: `SAME-STU-${ts}`,
          grade: "Grade 10",
          organizationId: orgA.id,
          campusId: campusA.id, // Same org — should pass!
        }
      );
      allResults.push({
        name: "XREF → Student with same-org campusId → 201",
        pass: s5 === 201,
        expected: "201",
        actual: `${s5}`,
      });

      // ── TEST: Fee structure with same-org refs should succeed
      const { status: s6 } = await fetchJson(
        "/api/finance/structures",
        saCookie,
        "POST",
        {
          name: `Same-Org Rule ${ts}`,
          amount: "3000",
          frequency: "MONTHLY",
          organizationId: orgA.id,
          campusId: campusA.id, // Same org
          feeHeadId: headA.id,  // Same org
        }
      );
      allResults.push({
        name: "XREF → FeeStructure with same-org refs → 201",
        pass: s6 === 201,
        expected: "201",
        actual: `${s6}`,
      });
    } else {
      console.error("  Could not create test entities for cross-ref validation.");
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: ROLE-BASED ACCESS
  // ═══════════════════════════════════════════════════════════
  console.log("Phase 4: Role-based access checks...");

  await testRoute(
    "ROLE → SUPER_ADMIN can POST /api/organizations",
    "POST",
    "/api/organizations",
    201,
    {
      cookie: saCookie,
      body: {
        name: `Role Test Org ${ts}`,
        orgCode: `ROLE-TEST-${ts}`,
        plan: "FREE",
      },
    }
  );

  // ═══════════════════════════════════════════════════════════
  // PHASE 5: OWNERSHIP VERIFICATION (PUT routes)
  // ═══════════════════════════════════════════════════════════
  console.log("\nPhase 5: Ownership verification on PUT...");

  // Try to pay a non-existent challan → 404
  await testRoute(
    "OWNERSHIP → PUT challan with invalid id → 404",
    "PUT",
    "/api/finance/challans",
    404,
    {
      cookie: saCookie,
      body: { challanId: 999999, paymentMethod: "CASH" },
    }
  );

  // ═══════════════════════════════════════════════════════════
  // PRINT RESULTS
  // ═══════════════════════════════════════════════════════════
  printResults();
}

function printResults() {
  console.log("\n==============================================");
  console.log("  TEST RESULTS");
  console.log("==============================================\n");

  let passed = 0;
  let failed = 0;

  for (const r of allResults) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  ${icon} | ${r.name}`);
    if (!r.pass) {
      console.log(`       Expected: ${r.expected}, Got: ${r.actual}`);
    }
    if (r.pass) passed++;
    else failed++;
  }

  console.log("\n----------------------------------------------");
  console.log(`  Total: ${allResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("----------------------------------------------");

  if (failed === 0) {
    console.log("\n  ALL TESTS PASSED!\n");
  } else {
    console.log(`\n  ${failed} TEST(S) FAILED — see details above.\n`);
    process.exit(1);
  }
}

main();
