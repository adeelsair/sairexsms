"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export type MobileTodayAction = {
  id: string;
  actionKey: string;
  type:
    | "FEE_COLLECTION"
    | "ABSENT_FOLLOWUP"
    | "STAFF_ATTENDANCE"
    | "ADMISSION_ENQUIRY"
    | "APPROVAL_PENDING"
    | "RESULT_PUBLISH"
    | "EXPENSE_APPROVAL";
  title: string;
  subtitle?: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  count?: number;
  amount?: number;
  deepLink: string;
  dueAt?: string;
};

export type MobileTodayActionsResponse = {
  urgent: MobileTodayAction[];
  attention: MobileTodayAction[];
  info: MobileTodayAction[];
  completedToday: MobileTodayAction[];
  meta: {
    completedToday: number;
    totalGeneratedToday: number;
    userName: string;
  };
};

export function useMobileTodayActions(orgId?: string | null) {
  return useQuery({
    queryKey: ["mobile-today-actions", orgId ?? "default"],
    queryFn: async (): Promise<MobileTodayActionsResponse> => {
      const suffix = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
      const result = await api.get<MobileTodayActionsResponse>(
        `/api/mobile/today-actions${suffix}`,
      );

      if (result.ok) {
        return result.data;
      }

      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
