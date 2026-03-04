"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { resolveMobileRoute } from "@/lib/mobile/mobile-route-map";
import { MobileRoute } from "@/lib/mobile/mobile-routes";

type MobilePrimaryAction = {
  id: string;
  label: string;
  route: MobileRoute;
};

const PRIMARY_ACTIONS: MobilePrimaryAction[] = [
  { id: "collect-fee", label: "Collect Fee", route: MobileRoute.COLLECT_FEE },
  {
    id: "mark-attendance",
    label: "Mark Attendance",
    route: MobileRoute.MARK_ATTENDANCE,
  },
  { id: "add-student", label: "Add Student", route: MobileRoute.ADD_STUDENT },
  {
    id: "issue-challan",
    label: "Issue Challan",
    route: MobileRoute.ISSUE_CHALLAN,
  },
];

export function PrimaryActionGrid() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-2">
      {PRIMARY_ACTIONS.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="secondary"
          className="h-12"
          onClick={() => router.push(resolveMobileRoute(action.route))}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
