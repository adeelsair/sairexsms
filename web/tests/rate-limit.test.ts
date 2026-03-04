import { describe, expect, it } from "vitest";
import { applyRateLimit, checkRateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("allows requests until limit is reached", () => {
    const key = `test-key-${Date.now()}-allow`;
    const config = { max: 2, windowSeconds: 60 };

    const first = checkRateLimit(key, config);
    const second = checkRateLimit(key, config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests after limit is exceeded", () => {
    const key = `test-key-${Date.now()}-block`;
    const config = { max: 1, windowSeconds: 60 };

    const first = checkRateLimit(key, config);
    const second = checkRateLimit(key, config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns HTTP 429 response from applyRateLimit when blocked", async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`;
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": ip },
    });
    const config = { max: 1, windowSeconds: 60 };
    const prefix = `apply-limit-${Date.now()}`;

    const first = applyRateLimit(req, prefix, config);
    const second = applyRateLimit(req, prefix, config);

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    expect(second?.headers.get("Retry-After")).toBeTruthy();

    const payload = second ? await second.json() : null;
    expect(payload?.error).toContain("Too many requests");
  });
});

