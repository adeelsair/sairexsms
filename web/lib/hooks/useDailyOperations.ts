"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";

export function useDailyOperations() {
  return useQuery({
    queryKey: ["daily-operations"],
    queryFn: async (): Promise<DailyOperationsSnapshot> => {
      const result = await api.get<DailyOperationsSnapshot>("/api/dashboard/daily-operations");
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
