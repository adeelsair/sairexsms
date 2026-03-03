import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  closeCycle,
  createMonthlyCycleForOrganization,
} from "@/lib/billing/revenue-cycle.service";

const CRON_NAME = "revenue-cycle-orchestrator";
const DEFAULT_ORG_TIMEZONE = "Asia/Karachi";
const REVENUE_CYCLE_CRON_LOCK_ID = 90241127133;

interface OrganizationForCron {
  id: string;
  timezone: string;
  closingDay: number;
}

interface ProcessResult {
  orgId: string;
  action: "CREATED_AND_CLOSED" | "CREATED_ONLY" | "CLOSED_ONLY" | "SKIPPED";
  status: "ok" | "failed";
  durationMs: number;
  error?: string;
}

export async function runRevenueCycleOrchestrator(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const startedAt = Date.now();
  const lockAcquired = await acquireCronLock();
  if (!lockAcquired) {
    logger.info(
      {
        cron: CRON_NAME,
        status: "skipped_due_to_active_runner",
      },
      "Skipping run because another instance is active",
    );
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  try {
    const organizations = await listOrganizationsForCron();
    const results: ProcessResult[] = [];

    for (const org of organizations) {
      const orgStartedAt = Date.now();
      try {
        const nowUtc = DateTime.utc();
        const orgNow = nowUtc.setZone(org.timezone);
        const currentMonth = orgNow.month;
        const currentYear = orgNow.year;
        const shouldClosePrevious = orgNow.day === org.closingDay;

        const currentCycle = await createMonthlyCycleForOrganization(
          org.id,
          currentMonth,
          currentYear,
        );

        if (currentCycle.created) {
          await emitDomainEventSafe(org.id, "RevenueCycleAutoCreated", {
            month: currentMonth,
            year: currentYear,
            timezone: org.timezone,
            triggeredAtUtc: nowUtc.toISO(),
          });
        }

        let closed = false;
        if (shouldClosePrevious) {
          const previous = orgNow.minus({ months: 1 });
          const previousOpenCycle = await prisma.revenueCycle.findUnique({
            where: {
              organizationId_month_year: {
                organizationId: org.id,
                month: previous.month,
                year: previous.year,
              },
            },
            select: { id: true, status: true },
          });

          if (previousOpenCycle?.status === "OPEN") {
            await closeCycle(previousOpenCycle.id, org.id);
            closed = true;
            await emitDomainEventSafe(org.id, "RevenueCycleAutoClosed", {
              month: previous.month,
              year: previous.year,
              timezone: org.timezone,
              closingDay: org.closingDay,
              triggeredAtUtc: nowUtc.toISO(),
            });
          }
        }

        const action = currentCycle.created
          ? closed
            ? "CREATED_AND_CLOSED"
            : "CREATED_ONLY"
          : closed
            ? "CLOSED_ONLY"
            : "SKIPPED";

        results.push({
          orgId: org.id,
          action,
          status: "ok",
          durationMs: Date.now() - orgStartedAt,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown revenue-cycle orchestrator error";

        await emitDomainEventSafe(org.id, "RevenueCycleCronFailed", {
          error: message,
          triggeredAtUtc: DateTime.utc().toISO(),
        });

        results.push({
          orgId: org.id,
          action: "SKIPPED",
          status: "failed",
          durationMs: Date.now() - orgStartedAt,
          error: message,
        });
      }
    }

    const succeeded = results.filter((item) => item.status === "ok").length;
    const failed = results.filter((item) => item.status === "failed").length;
    const skipped = results.filter((item) => item.action === "SKIPPED").length;
    const summary = {
      processed: results.length,
      succeeded,
      failed,
      skipped,
    };

    logger.info(
      {
        cron: CRON_NAME,
        durationMs: Date.now() - startedAt,
        summary,
        results,
      },
      "Revenue cycle orchestrator finished",
    );

    return summary;
  } finally {
    await releaseCronLock();
  }
}

async function listOrganizationsForCron(): Promise<OrganizationForCron[]> {
  const organizations = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      timezone: true,
      plan: { select: { closingDay: true } },
    },
  });

  return organizations.map((org) => ({
    id: org.id,
    timezone: normalizeTimezone(org.timezone),
    closingDay: org.plan?.closingDay ?? 10,
  }));
}

function normalizeTimezone(value: string | null | undefined): string {
  if (!value?.trim()) return DEFAULT_ORG_TIMEZONE;
  const zone = DateTime.utc().setZone(value);
  return zone.isValid ? value : DEFAULT_ORG_TIMEZONE;
}

async function emitDomainEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.domainEventLog.create({
    data: {
      organizationId,
      eventType,
      payload: {
        ...payload,
        _audit: {
          actorUserId: null,
          effectiveUserId: null,
          tenantId: organizationId,
          impersonation: false,
          impersonatedTenantId: null,
        },
      },
      occurredAt: new Date(),
    },
  });
}

async function emitDomainEventSafe(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await emitDomainEvent(organizationId, eventType, payload);
  } catch (error: unknown) {
    logger.error(
      {
        cron: CRON_NAME,
        organizationId,
        eventType,
        error: error instanceof Error ? error.message : "Unknown domain event error",
      },
      "Failed to persist cron domain event",
    );
  }
}

async function acquireCronLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${REVENUE_CYCLE_CRON_LOCK_ID}) AS locked
  `;
  return Boolean(rows[0]?.locked);
}

async function releaseCronLock(): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${REVENUE_CYCLE_CRON_LOCK_ID})
  `;
}
