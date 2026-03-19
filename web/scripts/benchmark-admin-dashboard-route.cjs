const BASE_URL = "http://localhost:3000";
const SUPER_EMAIL = "admin@sairex-sms.com";
const SUPER_PASSWORD = "Admin@123";

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
    return Array.from(this.map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
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
  try {
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
    return { status: res.status, elapsedMs, text, json };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    return {
      status: 599,
      elapsedMs,
      text: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const login = await request("/api/login", {
    method: "POST",
    jar,
    body: { email, password },
  });
  if (login.status < 200 || login.status >= 300) {
    throw new Error(`Local login failed for ${email}: ${login.status}`);
  }
  const session = await request("/api/auth/session", { jar });
  if (session.status < 200 || session.status >= 300 || !session.json?.user?.email) {
    throw new Error(`Session check failed for ${email}`);
  }
  return jar;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runConcurrent(count, fn) {
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: count }, (_, i) => fn(i)));
  const elapsedMs = Date.now() - started;
  const ok = results.filter((r) => r.status >= 200 && r.status < 400).length;
  const failed = results.length - ok;
  const latencies = results.map((r) => r.elapsedMs);
  const statuses = {};
  for (const r of results) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  return {
    requests: count,
    elapsedMs,
    avgMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    minMs: Math.min(...latencies),
    maxMs: Math.max(...latencies),
    ok,
    failed,
    successRate: Number(((ok / count) * 100).toFixed(2)),
    statuses,
  };
}

async function main() {
  const jar = await signIn(SUPER_EMAIL, SUPER_PASSWORD);
  const warmup = await request("/admin/dashboard", { jar });
  if (warmup.status >= 400) {
    throw new Error(`Warmup failed: ${warmup.status}`);
  }
  const run = await runConcurrent(100, async () => request("/admin/dashboard", { jar }));
  console.log(JSON.stringify({ route: "/admin/dashboard", concurrent100: run }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
