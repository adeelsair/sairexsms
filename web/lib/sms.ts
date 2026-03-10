import axios from "axios";

export function normalizePkPhone(phone: string): string {
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

function isDryRunEnabled(): boolean {
  const value = (process.env.SMS_DRY_RUN ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function resolveSmsProvider(): "veevo" | "android_gateway" {
  const provider = (process.env.SMS_PROVIDER ?? "veevo").trim().toLowerCase();
  if (provider === "android_gateway") {
    return "android_gateway";
  }
  return "veevo";
}

function assertSmsProviderConfigured() {
  const hash = process.env.VEEVO_HASH;
  const sender = process.env.VEEVO_SENDER;

  if (!hash || !sender) {
    if (isDryRunEnabled()) {
      return { hash: "", sender: "" };
    }
    throw new Error("VEEVO_HASH or VEEVO_SENDER is missing");
  }

  return { hash, sender };
}

function isProviderFailure(data: unknown): boolean {
  if (typeof data === "string") {
    const normalized = data.trim().toUpperCase();
    return normalized.includes("FAILED") || normalized.includes("ERROR");
  }

  if (data && typeof data === "object") {
    const status = String((data as { STATUS?: unknown }).STATUS ?? "").toUpperCase();
    const code = String((data as { CODE?: unknown }).CODE ?? "").toUpperCase();
    return status === "FAILED" || code === "FAILED" || code === "ERROR";
  }

  return false;
}

async function sendViaAndroidGateway(to: string, text: string): Promise<void> {
  const gatewayUrl = (process.env.ANDROID_SMS_GATEWAY_URL ?? "").trim();
  const token = (process.env.ANDROID_SMS_GATEWAY_TOKEN ?? "").trim();

  if (!gatewayUrl) {
    throw new Error("ANDROID_SMS_GATEWAY_URL is missing");
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await axios.post(
    gatewayUrl,
    {
      to,
      message: text,
    },
    {
      timeout: 15000,
      headers,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Android gateway HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }

  if (isProviderFailure(response.data)) {
    throw new Error(`Android gateway failed: ${JSON.stringify(response.data)}`);
  }

  console.log(`[Android SMS Gateway] to=${to} status=${response.status} response=`, response.data);
}

/**
 * Sends SMS through Veevo Tech.
 * Uses hash-based auth (primary), with optional login/password attached if provided.
 */
export async function sendSmsMessage(to: string, text: string): Promise<void> {
  const normalizedPhone = normalizePkPhone(to);
  const provider = resolveSmsProvider();

  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  if (isDryRunEnabled()) {
    console.log(`[SMS DRY RUN] to=${normalizedPhone} text="${text}"`);
    return;
  }

  if (provider === "android_gateway") {
    await sendViaAndroidGateway(normalizedPhone, text);
    return;
  }

  const { hash, sender } = assertSmsProviderConfigured();
  const loginId = process.env.VEEVO_LOGIN_ID;
  const password = process.env.VEEVO_PASSWORD;

  const params = new URLSearchParams({
    hash,
    receivenum: normalizedPhone,
    sendernum: sender,
    textmessage: text,
  });

  // Keep optional credential params for providers/accounts that require them.
  if (loginId) params.set("loginid", loginId);
  if (password) params.set("password", password);

  const url = `https://api.veevotech.com/sendsms?${params.toString()}`;
  const res = await axios.get(url, { timeout: 15000 });

  console.log(`[Veevo SMS] to=${normalizedPhone} sender=${sender} status=${res.status} response=`, res.data);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Veevo SMS HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }

  if (isProviderFailure(res.data)) {
    throw new Error(`Veevo SMS failed: ${JSON.stringify(res.data)}`);
  }
}
