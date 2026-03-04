"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export type MobileDashboardResponse = {
  kpis: Array<{ id: string; label: string; value: number }>;
  todayFocus: Array<{ id: string; label: string; value: number }>;
  alerts: Array<{ id: string; label: string; count: number; href?: string }>;
  role: string;
};

export function useMobileDashboard() {
  return useQuery({
    queryKey: ["mobile-dashboard"],
    queryFn: async (): Promise<MobileDashboardResponse> => {
      const result = await api.get<MobileDashboardResponse>(
        "/api/mobile/dashboard",
      );
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
