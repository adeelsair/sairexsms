import { createHash } from "crypto";

/**
 * Hash reset tokens before persisting/lookup so raw tokens are never stored.
 * Optional pepper adds an app-side secret layer on top of token entropy.
 */
export function hashPasswordResetToken(token: string): string {
  const normalized = token.trim();
  const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER ?? "";
  return createHash("sha256")
    .update(`${normalized}:${pepper}`)
    .digest("hex");
}

