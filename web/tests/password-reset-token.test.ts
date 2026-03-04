import { describe, expect, it } from "vitest";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";

describe("password reset token hashing", () => {
  it("returns stable hash for the same token when no pepper is set", () => {
    const token = "abc123token";
    const first = hashPasswordResetToken(token);
    const second = hashPasswordResetToken(token);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes surrounding whitespace before hashing", () => {
    const token = "secure-token";
    const withWhitespace = "  secure-token   ";

    expect(hashPasswordResetToken(token)).toBe(
      hashPasswordResetToken(withWhitespace),
    );
  });

  it("changes hash when token value changes", () => {
    const a = hashPasswordResetToken("token-a");
    const b = hashPasswordResetToken("token-b");

    expect(a).not.toBe(b);
  });
});

