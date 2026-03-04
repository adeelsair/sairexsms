import { enqueue, NOTIFICATION_QUEUE } from "@/lib/queue";

/**
 * Enqueues a parent notification job. The notification worker fans out
 * to individual email, SMS, and WhatsApp jobs asynchronously.
 *
 * Returns the notification job ID immediately — no blocking I/O.
 */
export async function notifyParent(
  student: { fullName: string; parentEmail?: string; parentPhone?: string },
  challan: { challanNo: string; totalAmount: unknown; dueDate: unknown; organizationId?: string },
  type: "GENERATED" | "REMINDER" | "PAID",
): Promise<string> {
  const jobId = await enqueue({
    type: "NOTIFICATION",
    queue: NOTIFICATION_QUEUE,
    organizationId: challan.organizationId,
    payload: {
      studentName: student.fullName,
      parentEmail: student.parentEmail ?? "",
      parentPhone: student.parentPhone ?? "",
      challanNo: challan.challanNo,
      totalAmount: String(challan.totalAmount),
      dueDate: String(challan.dueDate),
      type,
    },
  });

  return jobId;
}
