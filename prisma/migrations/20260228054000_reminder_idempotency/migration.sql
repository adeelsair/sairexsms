-- Enforce hard idempotency for reminder sends.
-- Keep a single log row per (organization, challan, reminder rule).
DELETE FROM "ReminderLog" AS newer
USING "ReminderLog" AS older
WHERE newer."organizationId" = older."organizationId"
  AND newer."challanId" = older."challanId"
  AND newer."reminderRuleId" = older."reminderRuleId"
  AND newer."challanId" IS NOT NULL
  AND older."challanId" IS NOT NULL
  AND (
    newer."sentAt" > older."sentAt"
    OR (newer."sentAt" = older."sentAt" AND newer."id" > older."id")
  );

CREATE UNIQUE INDEX "ReminderLog_organizationId_challanId_reminderRuleId_key"
ON "ReminderLog"("organizationId", "challanId", "reminderRuleId");
