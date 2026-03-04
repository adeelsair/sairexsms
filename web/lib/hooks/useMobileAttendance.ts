"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export type AttendanceClassQuickPick = {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  campusId: number;
  academicYearId: string;
  studentCount: number;
  isLastUsed: boolean;
};

export type AttendanceStudentItem = {
  enrollmentId: string;
  studentId: number;
  rollNumber: string | null;
  fullName: string;
  admissionNo: string;
};

type AttendanceStudentsResponse = {
  section: {
    sectionId: string;
    classId: string;
    campusId: number;
    academicYearId: string;
  };
  students: AttendanceStudentItem[];
};

export function useMobileAttendanceClasses() {
  return useQuery({
    queryKey: ["mobile-attendance-classes"],
    queryFn: async (): Promise<AttendanceClassQuickPick[]> => {
      const result = await api.get<AttendanceClassQuickPick[]>(
        "/api/mobile/attendance/classes",
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

export function useMobileAttendanceStudents(sectionId: string | null) {
  return useQuery({
    queryKey: ["mobile-attendance-students", sectionId],
    enabled: !!sectionId,
    queryFn: async (): Promise<AttendanceStudentsResponse> => {
      const result = await api.get<AttendanceStudentsResponse>(
        `/api/mobile/attendance/students?sectionId=${encodeURIComponent(sectionId ?? "")}`,
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
