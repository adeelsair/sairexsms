import type { DailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { AlertItem } from "./AlertItem";

interface AlertsPanelProps {
  alerts: DailyOperationsSnapshot["alerts"];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const total =
    alerts.unpaidChallans +
    alerts.feeDefaultersToday +
    alerts.pendingAdmissions +
    alerts.unmarkedStudentAttendance +
    alerts.unmarkedStaffAttendance +
    alerts.failedMessages;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-muted">
        Attention Required
      </h2>

      <AlertItem
        label="Unpaid challans"
        count={alerts.unpaidChallans}
        href="/admin/finance?tab=challans"
        variant="danger"
      />

      <AlertItem
        label="Fee defaulters today"
        count={alerts.feeDefaultersToday}
        href="/admin/finance?tab=challans"
        variant="warning"
      />

      <AlertItem
        label="Pending admissions"
        count={alerts.pendingAdmissions}
        href="/admin/enrollments?status=pending"
        variant="info"
      />

      <AlertItem
        label="Unmarked student attendance"
        count={alerts.unmarkedStudentAttendance}
        href="/admin/attendance"
        variant="warning"
      />

      <AlertItem
        label="Unmarked staff attendance"
        count={alerts.unmarkedStaffAttendance}
        href="/admin/attendance"
        variant="warning"
      />

      <AlertItem
        label="Failed messages"
        count={alerts.failedMessages}
        href="/admin/jobs"
        variant="danger"
      />

      {total === 0 && (
        <p className="rounded-xl border border-border bg-muted p-3 text-sm text-muted">
          No pending items {"\uD83C\uDF89"}
        </p>
      )}
    </div>
  );
}
