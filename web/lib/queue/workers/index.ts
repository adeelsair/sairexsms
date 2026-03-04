import { startEmailWorker } from "./email.worker";
import { startOtpWorker } from "./otp.worker";
import { startSmsWorker } from "./sms.worker";
import { startWhatsAppWorker } from "./whatsapp.worker";
import { startNotificationWorker } from "./notification.worker";
import { startChallanPdfWorker } from "./challan-pdf.worker";
import { startReportWorker } from "./report.worker";
import { startBulkSmsWorker } from "./bulk-sms.worker";
import { startImportWorker } from "./import.worker";
import { startFinanceWorker } from "./finance.worker";
import { startPromotionWorker } from "./promotion.worker";
import { startReminderWorker } from "./reminder.worker";
import { startSchedulerWorker, registerReminderDailySchedule } from "./scheduler.worker";
import { startSystemWorker } from "./system.worker";
import { startEventHandlerWorker } from "./event-handler.worker";
import { startWebhookWorker } from "./webhook.worker";
import { logger } from "@/lib/logger";

let started = false;

/**
 * Starts all background workers. Safe to call multiple times —
 * only bootstraps once per process.
 */
export function startWorkers(): void {
  if (started) return;
  started = true;

  logger.info("Bootstrapping background job workers…");

  /* Messaging workers */
  startEmailWorker();
  startOtpWorker();
  startSmsWorker();
  startWhatsAppWorker();
  startNotificationWorker();
  startChallanPdfWorker();
  startBulkSmsWorker();
  startImportWorker();

  /* Domain workers */
  startFinanceWorker();
  startPromotionWorker();
  startReminderWorker();
  startSchedulerWorker();
  startReportWorker();

  /* Payment gateway webhook worker */
  startWebhookWorker();

  /* Event-driven architecture worker */
  startEventHandlerWorker();

  /* System maintenance worker */
  startSystemWorker();

  void registerReminderDailySchedule().catch((error) => {
    logger.error({ error }, "Failed to register reminder daily schedule");
  });

  logger.info({ totalQueues: 16 }, "All workers started");
}

export function areWorkersStarted(): boolean {
  return started;
}
