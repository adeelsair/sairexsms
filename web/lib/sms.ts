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

function resolveSmsProvider(): "veevo" | "smsmobileapi" {
  const provider = (process.env.SMS_PROVIDER ?? "veevo").trim().toLowerCase();
  if (provider === "smsmobileapi") {
    return "smsmobileapi";
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
    if (status === "FAILED" || code === "FAILED" || code === "ERROR") {
      return true;
    }

    // Veevo: { error: 'AUTH_FAILED' } or similar
    const error = String((data as { error?: unknown }).error ?? "").trim().toUpperCase();
    if (error && (error.includes("FAILED") || error.includes("ERROR") || error.includes("AUTH"))) {
      return true;
    }

    // SMSMobileAPI nested result payload shape
    const result = (data as { result?: unknown }).result;
    if (result && typeof result === "object") {
      const nestedError = String((result as { error?: unknown }).error ?? "").trim();
      const nestedSent = String((result as { sent?: unknown }).sent ?? "").toLowerCase();
      if ((nestedError && nestedError !== "0") || nestedSent === "api_error") {
        return true;
      }
    }
  }

  return false;
}

async function sendViaSmsMobileApi(to: string, text: string): Promise<void> {
  const apiKey = (process.env.SMSMOBILE_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("SMSMOBILE_API_KEY is missing");
  }

  const endpoint = (process.env.SMSMOBILE_API_URL ?? "https://api.smsmobileapi.com/sendsms/").trim();
  const sendWa = (process.env.SMSMOBILE_SEND_WA ?? "").trim();
  const sendSms = (process.env.SMSMOBILE_SEND_SMS ?? "1").trim();

  const payload = new URLSearchParams({
    apikey: apiKey,
    recipients: `+${to}`,
    message: text,
    sendsms: sendSms,
  });
  if (sendWa) {
    payload.set("sendwa", sendWa);
  }

  const response = await axios.post(endpoint, payload.toString(), {
    timeout: 15000,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`SMSMobileAPI HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }

  if (isProviderFailure(response.data)) {
    throw new Error(`SMSMobileAPI failed: ${JSON.stringify(response.data)}`);
  }

  console.log(`[SMSMobileAPI] to=${to} status=${response.status} response=`, response.data);
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

  if (provider === "smsmobileapi") {
    await sendViaSmsMobileApi(normalizedPhone, text);
    return;
  }

  const { hash, sender } = assertSmsProviderConfigured();

  // Veevo v3 API: POST JSON to https://api.veevotech.com/v3/sendsms
  const receivernum = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
  const body = {
    hash,
    receivernum,
    sendernum: sender,
    textmessage: text,
  };

  const url = "https://api.veevotech.com/v3/sendsms";
  const res = await axios.post(url, body, {
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
  });

  console.log(`[Veevo SMS] v3 to=${receivernum} sender=${sender} status=${res.status} response=`, res.data);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Veevo SMS HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }

  if (isProviderFailure(res.data)) {
    throw new Error(`Veevo SMS failed: ${JSON.stringify(res.data)}`);
  }
}
