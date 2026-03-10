import { z } from "zod";

export const sendSingleSmsSchema = z.object({
  phone: z.string().min(7, "Phone number is required"),
  message: z.string().min(1, "Message is required").max(640, "Message too long (max 640 chars)"),
});

export type SendSingleSmsInput = z.infer<typeof sendSingleSmsSchema>;

export const sendBulkSmsSchema = z.object({
  recipientsText: z.string().min(1, "At least one recipient is required"),
  message: z.string().min(1, "Message is required").max(640, "Message too long (max 640 chars)"),
});

export type SendBulkSmsInput = z.infer<typeof sendBulkSmsSchema>;

