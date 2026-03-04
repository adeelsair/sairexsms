import { z } from "zod";

export const createClassSchema = z.object({
  name: z
    .string()
    .min(1, "Class name is required")
    .max(100, "Class name must not exceed 100 characters"),
  code: z.string().max(20).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).optional().or(z.literal("")),
});

export type CreateClassInput = z.input<typeof createClassSchema>;
export type CreateClassData = z.output<typeof createClassSchema>;

export const createSectionSchema = z.object({
  name: z
    .string()
    .min(1, "Section name is required")
    .max(50, "Section name must not exceed 50 characters"),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "Capacity must be at least 1")
    .optional()
    .or(z.literal("")),
});

export type CreateSectionInput = z.input<typeof createSectionSchema>;
export type CreateSectionData = z.output<typeof createSectionSchema>;
