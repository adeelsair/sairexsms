/**
 * AES-256-GCM Encryption Utility
 *
 * Used to encrypt sensitive configuration fields at the application layer:
 *   - Payment gateway API keys / secrets
 *   - WhatsApp Cloud API tokens
 *   - SMS provider credentials
 *
 * The encryption key is loaded from ENCRYPTION_KEY env variable (32-byte hex).
 * Never store secrets in plain JSON in the database.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string. Returns a base64-encoded payload
 * containing IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, encrypted, tag]);
  return payload.toString("base64");
}

/**
 * Decrypts a base64-encoded payload produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const payload = Buffer.from(encoded, "base64");

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypts a JSON object's sensitive fields.
 * Wraps the full object in a single encrypted blob.
 */
export function encryptConfig(config: Record<string, unknown>): string {
  return encrypt(JSON.stringify(config));
}

/**
 * Decrypts a config blob back to a JSON object.
 */
export function decryptConfig(encoded: string): Record<string, unknown> {
  const json = decrypt(encoded);
  return JSON.parse(json) as Record<string, unknown>;
}
