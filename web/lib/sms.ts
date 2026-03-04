import axios from "axios";

function normalizePkPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // 03XXXXXXXXX -> 923XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }

  // +923XXXXXXXXX or 923XXXXXXXXX
  if (digits.startsWith("92")) {
    return digits;
  }

  // Fallback: return digits-only as-is
  return digits;
}

/**
 * Sends SMS through Veevo Tech.
 * Uses hash-based auth (primary), with optional login/password attached if provided.
 */
export async function sendSmsMessage(to: string, text: string): Promise<void> {
  const hash = process.env.VEEVO_HASH;
  const sender = process.env.VEEVO_SENDER;
  const loginId = process.env.VEEVO_LOGIN_ID;
  const password = process.env.VEEVO_PASSWORD;

  if (!hash || !sender) {
    throw new Error("VEEVO_HASH or VEEVO_SENDER is missing");
  }

  const params = new URLSearchParams({
    hash,
    receivenum: normalizePkPhone(to),
    sendernum: sender,
    textmessage: text,
  });

  // Keep optional credential params for providers/accounts that require them.
  if (loginId) params.set("loginid", loginId);
  if (password) params.set("password", password);

  const url = `https://api.veevotech.com/sendsms?${params.toString()}`;
  const res = await axios.get(url, { timeout: 15000 });

  console.log(`[Veevo SMS] to=${normalizePkPhone(to)} sender=${sender} status=${res.status} response=`, res.data);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Veevo SMS HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }

  if (res.data && typeof res.data === "object" && res.data.STATUS === "FAILED") {
    throw new Error(`Veevo SMS failed: ${JSON.stringify(res.data)}`);
  }
}
