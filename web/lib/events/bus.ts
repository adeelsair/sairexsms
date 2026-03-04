/**
 * In-process Event Bus with sync/async dispatch, event persistence,
 * and idempotency checking.
 *
 * Sync handlers run in-process (same request cycle).
 * Async handlers are pushed to BullMQ queues.
 */
import { createId } from "@paralleldrive/cuid2";
import type { AuditActorContext } from "@/lib/audit/resolve-audit-actor";
import type {
  DomainEvent,
  EventPayloadMap,
  HandlerRegistration,
} from "./types";

/* ── Handler Store ─────────────────────────────────────── */

const registrations: HandlerRegistration[] = [];

/**
 * Register a synchronous handler — runs in the same request cycle.
 * Use for critical DB updates that must succeed atomically.
 */
export function onSync<K extends keyof EventPayloadMap>(
  eventType: K,
  handlerName: string,
  handler: (event: DomainEvent<EventPayloadMap[K]>) => Promise<void>,
): void {
  registrations.push({
    eventType,
    handlerName,
    handler: handler as HandlerRegistration["handler"],
    async: false,
  });
}

/**
 * Register an asynchronous handler — dispatched via BullMQ.
 * Use for notifications, analytics, and non-critical side effects.
 */
export function onAsync<K extends keyof EventPayloadMap>(
  eventType: K,
  handlerName: string,
  handler: (event: DomainEvent<EventPayloadMap[K]>) => Promise<void>,
): void {
  registrations.push({
    eventType,
    handlerName,
    handler: handler as HandlerRegistration["handler"],
    async: true,
  });
}

/* ── Event Construction ────────────────────────────────── */

export function createEvent<K extends keyof EventPayloadMap>(
  eventType: K,
  organizationId: string,
  payload: EventPayloadMap[K],
  audit?: number | AuditActorContext,
): DomainEvent<EventPayloadMap[K]> {
  const auditContext = typeof audit === "number"
    ? {
        actorUserId: audit,
        effectiveUserId: audit,
        tenantId: organizationId,
        impersonation: false,
      }
    : audit;

  return {
    eventId: createId(),
    eventType,
    occurredAt: new Date(),
    organizationId,
    initiatedByUserId: auditContext?.actorUserId,
    effectiveUserId: auditContext?.effectiveUserId,
    impersonation: auditContext?.impersonation ?? false,
    impersonatedTenantId: auditContext?.impersonation ? auditContext.tenantId : undefined,
    payload,
  };
}

/* ── Dispatch ──────────────────────────────────────────── */

interface DispatchResult {
  eventId: string;
  syncHandlersRun: number;
  asyncHandlersQueued: number;
  errors: string[];
}

/**
 * Dispatch an event to all registered handlers.
 *
 * 1. Persists event to DomainEventLog (fire-and-forget, non-blocking).
 * 2. Runs all sync handlers sequentially (errors collected, not thrown).
 * 3. Enqueues all async handlers to BullMQ (errors collected, not thrown).
 *
 * Dispatch never throws — callers should inspect result.errors if needed.
 */
export async function dispatchEvent<K extends keyof EventPayloadMap>(
  event: DomainEvent<EventPayloadMap[K]>,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    eventId: event.eventId,
    syncHandlersRun: 0,
    asyncHandlersQueued: 0,
    errors: [],
  };

  persistEvent(event).catch((err) => {
    console.error(`[EventBus] Failed to persist event ${event.eventId}:`, err);
  });

  const matched = registrations.filter((r) => r.eventType === event.eventType);

  for (const reg of matched) {
    if (!reg.async) {
      try {
        await reg.handler(event);
        result.syncHandlersRun++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`[sync:${reg.handlerName}] ${msg}`);
        console.error(
          `[EventBus] Sync handler "${reg.handlerName}" failed for ${event.eventType}:`,
          msg,
        );
      }
    } else {
      try {
        await enqueueAsyncHandler(event, reg);
        result.asyncHandlersQueued++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`[async:${reg.handlerName}] ${msg}`);
        console.error(
          `[EventBus] Failed to enqueue async handler "${reg.handlerName}" for ${event.eventType}:`,
          msg,
        );
      }
    }
  }

  return result;
}

/* ── Shorthand: create + dispatch in one call ──────────── */

export async function emit<K extends keyof EventPayloadMap>(
  eventType: K,
  organizationId: string,
  payload: EventPayloadMap[K],
  audit?: number | AuditActorContext,
): Promise<DispatchResult> {
  const event = createEvent(eventType, organizationId, payload, audit);
  return dispatchEvent(event);
}

/* ── Persistence ───────────────────────────────────────── */

async function persistEvent(event: DomainEvent): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const payloadObject =
    typeof event.payload === "object" && event.payload !== null
      ? (event.payload as Record<string, unknown>)
      : { value: event.payload };
  const payloadWithAudit = {
    ...payloadObject,
    _audit: {
      actorUserId: event.initiatedByUserId ?? null,
      effectiveUserId: event.effectiveUserId ?? null,
      tenantId: event.organizationId,
      impersonation: Boolean(event.impersonation),
      impersonatedTenantId: event.impersonatedTenantId ?? null,
    },
  };

  await prisma.domainEventLog.create({
    data: {
      id: event.eventId,
      organizationId: event.organizationId,
      eventType: event.eventType,
      payload: payloadWithAudit,
      occurredAt: event.occurredAt,
      initiatedByUserId: event.initiatedByUserId ?? null,
    },
  });
}

/* ── Async Handler Enqueue ─────────────────────────────── */

const EVENT_HANDLER_QUEUE = "event-handlers";

async function enqueueAsyncHandler(
  event: DomainEvent,
  reg: HandlerRegistration,
): Promise<void> {
  const { enqueue } = await import("@/lib/queue");

  await enqueue({
    type: `EVENT_${event.eventType}`,
    queue: EVENT_HANDLER_QUEUE,
    payload: {
      eventId: event.eventId,
      eventType: event.eventType,
      handlerName: reg.handlerName,
      organizationId: event.organizationId,
      initiatedByUserId: event.initiatedByUserId,
      effectiveUserId: event.effectiveUserId,
      impersonation: event.impersonation,
      impersonatedTenantId: event.impersonatedTenantId,
      occurredAt: event.occurredAt.toISOString(),
      eventPayload: event.payload,
    },
    organizationId: event.organizationId,
    userId: event.initiatedByUserId,
    idempotencyKey: `evt-${event.eventId}-${reg.handlerName}`,
  });
}

/* ── Introspection ─────────────────────────────────────── */

export function getRegisteredHandlers(): ReadonlyArray<{
  eventType: string;
  handlerName: string;
  async: boolean;
}> {
  return registrations.map((r) => ({
    eventType: r.eventType,
    handlerName: r.handlerName,
    async: r.async,
  }));
}

/**
 * Resolve a handler by name (used by the event-handler worker
 * to execute queued async handlers).
 */
export function resolveHandler(handlerName: string): HandlerRegistration | undefined {
  return registrations.find((r) => r.handlerName === handlerName);
}
