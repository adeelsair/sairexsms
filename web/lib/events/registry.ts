/**
 * Event Handler Registry — bootstraps all domain event handlers.
 *
 * Call `initializeEventHandlers()` once at application startup
 * (both in the API server and in the worker process).
 */
import { registerNotificationHandlers } from "./handlers/notification.handler";
import { registerAnalyticsHandlers } from "./handlers/analytics.handler";
import { registerAuditHandlers } from "./handlers/audit.handler";
import { registerPromotionHandlers } from "./handlers/promotion.handler";
import { registerAdoptionHandlers } from "./handlers/adoption.handler";
import { getRegisteredHandlers } from "./bus";

let initialized = false;

export function initializeEventHandlers(): void {
  if (initialized) return;
  initialized = true;

  console.log("[Events] Registering domain event handlers…");

  registerAuditHandlers();
  registerNotificationHandlers();
  registerAnalyticsHandlers();
  registerPromotionHandlers();
  registerAdoptionHandlers();

  const handlers = getRegisteredHandlers();
  const syncCount = handlers.filter((h) => !h.async).length;
  const asyncCount = handlers.filter((h) => h.async).length;

  console.log(
    `[Events] Registered ${handlers.length} handlers (${syncCount} sync, ${asyncCount} async) ` +
    `across ${new Set(handlers.map((h) => h.eventType)).size} event types.`,
  );
}
