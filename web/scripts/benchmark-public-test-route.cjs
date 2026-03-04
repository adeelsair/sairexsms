const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const TARGET_ROUTE = "/public-test";

async function request(pathname, { method = "GET" } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${pathname}`, {
      method,
      redirect: "manual",
    });
    const elapsedMs = Date.now() - started;
    const text = await res.text();
    return { status: res.status, elapsedMs, text };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    return {
      status: 599,
      elapsedMs,
      text: error instanceof Error ? error.message : "fetch failed",
    };
  }
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
    ok,
    failed,
    successRate: Number(((ok / count) * 100).toFixed(2)),
    statuses,
  };
}

async function main() {
  const warmup = await request(TARGET_ROUTE);
  const warmupStatus = warmup.status;

  const benchmark = await runConcurrent(100, async () => request(TARGET_ROUTE));
  const payload = { route: TARGET_ROUTE, warmupStatus, concurrent100: benchmark };
  const outputPath = path.join(__dirname, "..", "artifacts", "public-test-benchmark.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
