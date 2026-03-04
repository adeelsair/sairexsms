import { z } from "zod";

export const schoolInfoSchema = z.object({
  token: z.string().min(1).optional(),
  schoolName: z.string().min(2).max(150),
  city: z.string().min(2).max(100),
  contactNumber: z.string().min(7).max(20),
  approxStudents: z.enum([
    "1-100",
    "101-300",
    "301-600",
    "601-1000",
    "1000+",
  ]),
});

export const academicSetupSchema = z.object({
  token: z.string().min(1),
  classes: z.array(z.number().int().min(1).max(12)).min(1),
  sectionsPerClass: z.number().int().min(1).max(10).default(1),
});

export const feeSetupSchema = z.object({
  token: z.string().min(1),
  averageMonthlyFee: z.number().positive().max(500000),
});

export const adminCreateSchema = z.object({
  token: z.string().min(1),
  adminName: z.string().min(2).max(150),
  mobile: z.string().min(7).max(20),
  password: z.string().min(8).max(72),
});

export const onboardingCompleteWizardSchema = z.object({
  token: z.string().min(1),
});

export type SchoolInfoInput = z.infer<typeof schoolInfoSchema>;
export type AcademicSetupInput = z.infer<typeof academicSetupSchema>;
export type FeeSetupInput = z.infer<typeof feeSetupSchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
