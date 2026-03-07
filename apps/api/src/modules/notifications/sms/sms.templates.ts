export const smsTemplates = {
  feeReminder: "Dear Parent, your fee of {{amount}} is due on {{due_date}}.",
  attendanceAlert: "{{student_name}} was marked {{status}} on {{date}}.",
  paymentConfirmation: "Payment of {{amount}} received for {{student_name}}. Thank you.",
} as const
