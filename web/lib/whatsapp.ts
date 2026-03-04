import qrcode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";

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
  const client = await initWhatsAppClient();
  const chatId = toWhatsAppChatId(phone);
  return client.sendMessage(chatId, text);
}
