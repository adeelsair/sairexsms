import { describe, expect, it } from "vitest";
import { isWebhookReplay, isWebhookTimestampValid } from "@/lib/security";

describe("webhook security guards", () => {
  it("marks first webhook id as non-replay and second as replay", () => {
    const id = `wh-${Date.now()}-${Math.random()}`;

    const first = isWebhookReplay(id);
    const second = isWebhookReplay(id);

    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it("accepts current webhook timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isWebhookTimestampValid(now, 300)).toBe(true);
  });

  it("rejects stale webhook timestamp", () => {
    const stale = Math.floor(Date.now() / 1000) - 3600;
    expect(isWebhookTimestampValid(stale, 300)).toBe(false);
  });
});

