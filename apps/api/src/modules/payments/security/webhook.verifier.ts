import crypto from "crypto";

export function verifySignature(payload: unknown, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return hash === signature;
}

