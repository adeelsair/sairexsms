import { QuickActionButton } from "./QuickActionButton";

interface QuickAction {
  label: string;
  href: string;
}

interface QuickActionsPanelProps {
  role: string;
}

const ACTIONS: Record<string, QuickAction[]> = {
  CAMPUS_ADMIN: [
    { label: "Mark Attendance", href: "/admin/attendance" },
    { label: "Collect Fee", href: "/admin/payments" },
    { label: "New Admission", href: "/admin/enrollments" },
    { label: "Send Notice", href: "/admin/jobs" },
    { label: "Print Challan", href: "/admin/finance?tab=challans" },
  ],
  ACCOUNTANT: [
    { label: "Collect Fee", href: "/admin/payments" },
    { label: "Verify Payments", href: "/admin/payments" },
    { label: "Generate Challans", href: "/admin/finance?tab=challans" },
    { label: "Add Expense", href: "/admin/finance" },
  ],
  ORG_ADMIN: [
    { label: "New Campus", href: "/admin/campuses" },
    { label: "Send Broadcast", href: "/admin/jobs" },
    { label: "View Reports", href: "/admin/dashboard" },
    { label: "Fee Structure", href: "/admin/finance?tab=structures" },
  ],
  SUPER_ADMIN: [
    { label: "New Organization", href: "/admin/organizations" },
    { label: "Platform Reports", href: "/admin/dashboard" },
    { label: "Broadcast All", href: "/admin/jobs" },
  ],
};

export function QuickActionsPanel({ role }: QuickActionsPanelProps) {
  const normalizedRole = role.toUpperCase();
  const roleActions = ACTIONS[normalizedRole] ?? [];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-muted">
        Quick Actions
      </h2>

      {roleActions.length === 0 ? (
        <p className="text-sm text-muted">No quick actions available for this role.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {roleActions.map((action) => (
            <QuickActionButton
              key={`${normalizedRole}-${action.label}`}
              label={action.label}
              href={action.href}
            />
          ))}
        </div>
      )}
    </div>
  );
}
