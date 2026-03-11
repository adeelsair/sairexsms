import { z } from "zod";

export const sendBulkEmailSchema = z.object({
  recipientsText: z.string().min(1, "At least one recipient is required"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject is too long"),
  message: z.string().min(1, "Message is required").max(5000, "Message is too long"),
});

export type SendBulkEmailInput = z.infer<typeof sendBulkEmailSchema>;

export const sendWhatsAppSingleSchema = z.object({
  phone: z.string().min(7, "Phone number is required"),
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
});

export type SendWhatsAppSingleInput = z.infer<typeof sendWhatsAppSingleSchema>;

export const sendWhatsAppBulkSchema = z.object({
  recipientsText: z.string().min(1, "At least one recipient is required"),
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
});

export type SendWhatsAppBulkInput = z.infer<typeof sendWhatsAppBulkSchema>;

