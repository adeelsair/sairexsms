import axios from "axios";
import qrcode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";

// Use http as per Veevo doc; override with VEEVO_WHATSAPP_URL if needed
const VEEVO_WA_URL = process.env.VEEVO_WHATSAPP_URL || "http://wa-api.veevotech.com/wa/v1/send_message";

function resolveWhatsAppProvider(): "veevo" | "whatsapp-web" {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "whatsapp-web").trim().toLowerCase();
  return provider === "veevo" ? "veevo" : "whatsapp-web";
}

function normalizePkPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith("92")) {
    return digits;
  }
  return digits;
}

async function sendWhatsAppViaVeevo(phone: string, text: string): Promise<void> {
  const hash = (process.env.VEEVO_HASH ?? "").trim();
  if (!hash) {
    throw new Error("VEEVO_HASH is required for Veevo WhatsApp");
  }
  const normalized = normalizePkPhone(phone);
  const receivernum = normalized.startsWith("+") ? normalized : `+${normalized}`;

  // Veevo WhatsApp API: hash in header per their doc ("Request Headers hash:"); body has receivernum + textmessage
  const res = await axios.post(
    VEEVO_WA_URL,
    { receivernum, textmessage: text },
    {
      timeout: 25000,
      headers: {
        "Content-Type": "application/json",
        hash,
      },
    },
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Veevo WhatsApp HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }
  const data = res.data as unknown;
  if (data && typeof data === "object" && typeof (data as { error?: string }).error === "string") {
    throw new Error(`Veevo WhatsApp failed: ${(data as { error: string }).error}`);
  }
  console.log("[Veevo WhatsApp] to=", receivernum, "status=", res.status, "response=", res.data);
}

let clientInstance: Client | null = null;
let initPromise: Promise<Client> | null = null;

export async function initWhatsAppClient(): Promise<Client> {
  if (clientInstance) return clientInstance;
  if (initPromise) return initPromise;

  initPromise = new Promise<Client>((resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth({
        // Keeps session under web/.wwebjs_auth
        dataPath: ".wwebjs_auth",
      }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    client.on("qr", (qr) => {
      console.log("Scan this WhatsApp QR in terminal:");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      console.log("WhatsApp client is ready.");
      clientInstance = client;
      resolve(client);
    });

    client.on("auth_failure", (msg) => {
      console.error("WhatsApp auth failure:", msg);
      reject(new Error(`WhatsApp auth failure: ${msg}`));
    });

    client.on("disconnected", (reason) => {
      console.warn("WhatsApp disconnected:", reason);
      clientInstance = null;
      initPromise = null;
    });

    client.initialize().catch((err) => {
      console.error("WhatsApp init failed:", err);
      initPromise = null;
      reject(err);
    });
  });

  return initPromise;
}

export function getWhatsAppClient(): Client | null {
  return clientInstance;
}

function toWhatsAppChatId(phone: string): string {
  // Keep digits only, then normalize common PK formats.
  let digits = phone.replace(/\D/g, "");

  // Local PK mobile format: 03XXXXXXXXX -> 92XXXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  }

  // International PK format without +: 92XXXXXXXXXX (already fine)
  // If still not in expected format, fail fast.
  if (!digits.startsWith("92") || digits.length < 12) {
    throw new Error(`Invalid WhatsApp phone format: ${phone}`);
  }

  return `${digits}@c.us`;
}

export async function sendWhatsAppMessage(phone: string, text: string) {
  if (resolveWhatsAppProvider() === "veevo") {
    await sendWhatsAppViaVeevo(phone, text);
    return;
  }
  const client = await initWhatsAppClient();
  const chatId = toWhatsAppChatId(phone);
  return client.sendMessage(chatId, text);
}
