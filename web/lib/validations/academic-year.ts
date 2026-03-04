import { z } from "zod";

export const ACADEMIC_YEAR_STATUS = [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
] as const;

export const academicYearSchema = z
  .object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters")
      .max(50, "Name must not exceed 50 characters"),
    startDate: z.coerce.date({ message: "Start date is required" }),
    endDate: z.coerce.date({ message: "End date is required" }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type AcademicYearInput = z.input<typeof academicYearSchema>;
export type AcademicYearData = z.output<typeof academicYearSchema>;
