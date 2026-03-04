"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export type QuickAdmissionClass = {
  classId: string;
  className: string;
  campusId: number;
  academicYearId: string;
  studentCount: number;
  isLastUsed: boolean;
};

export function useMobileQuickAdmissionClasses() {
  return useQuery({
    queryKey: ["mobile-quick-admission-classes"],
    queryFn: async (): Promise<QuickAdmissionClass[]> => {
      const result = await api.get<QuickAdmissionClass[]>(
        "/api/mobile/students/classes",
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
