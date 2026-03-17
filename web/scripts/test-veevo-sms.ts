/**
 * Send one test SMS via Veevo to verify configuration.
 *
 * Usage (from web/):
 *   npx tsx scripts/test-veevo-sms.ts
 *   npx tsx scripts/test-veevo-sms.ts 03001234567
 *
 * Or with env file:
 *   SMS_TEST_PHONE=03001234567 npx tsx scripts/test-veevo-sms.ts
 *
 * Ensure .env has VEEVO_HASH and VEEVO_SENDER set (see .env.example).
 * Use SMS_DRY_RUN=1 to log the message without sending.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const phone = process.env.SMS_TEST_PHONE ?? process.argv[2];
  if (!phone || phone.length < 10) {
    console.error("Usage: npx tsx scripts/test-veevo-sms.ts <phone>");
    console.error("   or: SMS_TEST_PHONE=03001234567 npx tsx scripts/test-veevo-sms.ts");
    console.error("Phone can be 03XXXXXXXXX, +923XXXXXXXXX, or 923XXXXXXXXX");
    process.exit(1);
  }

  const hash = process.env.VEEVO_HASH;
  const sender = process.env.VEEVO_SENDER;
  if (!hash || !sender) {
    console.error("Missing VEEVO_HASH or VEEVO_SENDER in .env. See .env.example.");
    process.exit(1);
  }

  if (process.env.SMS_DRY_RUN) {
    console.log("[SMS_DRY_RUN=1] Would send to", phone, "- set SMS_DRY_RUN=0 or unset to send for real.");
  }

  const { sendSmsMessage } = await import("../lib/sms");
  const message = "SAIREX SMS test. If you received this, Veevo is configured correctly.";

  try {
    await sendSmsMessage(phone, message);
    console.log("SMS sent successfully to", phone);
  } catch (err) {
    console.error("SMS failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
