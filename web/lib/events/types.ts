/**
 * Domain Event Architecture — Type Definitions
 *
 * All events use past-tense naming (facts that happened).
 * Every event carries organizationId for tenant isolation.
 */

/* ── Base Event ────────────────────────────────────────── */

export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  organizationId: string;
  initiatedByUserId?: number;
  effectiveUserId?: number;
  impersonation?: boolean;
  impersonatedTenantId?: string;
  payload: T;
}

/* ── Finance Events ────────────────────────────────────── */

export interface PaymentReceivedPayload {
  paymentRecordId: string;
  bankAccountId?: string;
  amount: number;
  transactionRef?: string;
  paymentChannel: string;
}

export interface PaymentReconciledPayload {
  paymentRecordId: string;
  challanId: number;
  studentId: number;
  campusId: number;
  amount: number;
  challanStatus: string;
  newPaidAmount: number;
  ledgerEntryId: string;
}

export interface PaymentReversedPayload {
  paymentRecordId: string;
  challanId: number;
  studentId: number;
  amount: number;
  reason: string;
}

export interface ChallanCreatedPayload {
  challanId: number;
  studentId: number;
  campusId: number;
  totalAmount: number;
  dueDate: string;
  challanNo: string;
  feeStructureId?: number;
}

export interface FeePostingCompletedPayload {
  postingRunId: string;
  month: number;
  year: number;
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
}

export interface FeePostingFailedPayload {
  postingRunId: string;
  month: number;
  year: number;
  errorMessage: string;
}

/* ── Academic Events ───────────────────────────────────── */

export interface StudentEnrolledPayload {
  enrollmentId: string;
  studentId: number;
  campusId: number;
  academicYearId: string;
  classId: string;
  sectionId?: string;
}

export interface StudentPromotedPayload {
  enrollmentId: string;
  studentId: number;
  campusId: number;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  fromClassId: string;
  toClassId: string;
  action: "PROMOTED" | "RETAINED" | "GRADUATED";
}

export interface StudentWithdrawnPayload {
  enrollmentId: string;
  studentId: number;
  campusId: number;
  academicYearId: string;
}

export interface StudentTransferredPayload {
  enrollmentId: string;
  studentId: number;
  fromCampusId: number;
  toCampusId: number;
  academicYearId: string;
}

export interface AcademicYearClosedPayload {
  academicYearId: string;
  name: string;
}

export interface AcademicYearActivatedPayload {
  academicYearId: string;
  name: string;
}

export interface ExamPublishedPayload {
  examId: string;
  campusId: string;
  classId: string;
  sectionId?: string;
  examType: string;
  name: string;
}

export interface PromotionRunCompletedPayload {
  promotionRunId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  totalStudents: number;
  promoted: number;
  retained: number;
  graduated: number;
  errors: number;
}

/* ── Notification Events ───────────────────────────────── */

export interface ReminderRunCompletedPayload {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/* ── Adoption Events ───────────────────────────────────── */

export interface OtpRequestedPayload {
  phone: string;
  channel: string;
  otpSessionId: string;
}

export interface PhoneLoginCompletedPayload {
  userId: number;
  phone: string;
  isNewUser: boolean;
}

export interface QrTokenGeneratedPayload {
  tokenId: string;
  type: string;
  referenceId: string;
}

export interface QrTokenResolvedPayload {
  tokenId: string;
  type: string;
  referenceId: string;
}

export interface ParentAccessCreatedPayload {
  userId: number;
  membershipId: number;
  studentId: number;
  campusId: number;
}

export interface WizardStepCompletedPayload {
  stepKey: string;
  stepNumber: number;
  completed: boolean;
}

export interface OrganizationBootstrappedPayload {
  academicYearId: string;
  academicYearName: string;
  campusIds: number[];
  classCount: number;
  sectionCount: number;
  feeStructureCount: number;
}

export interface PaymentInitiatedPayload {
  paymentRecordId: string;
  challanId: number;
  gateway: string;
  gatewayRef: string;
  amount: number;
}

export interface WebhookProcessedPayload {
  paymentRecordId: string;
  gateway: string;
  gatewayRef: string;
  status: string;
}

export interface ReminderSentPayload {
  studentId: number;
  challanId: number | null;
  channel: string;
  triggerType: string;
  ruleId: string;
}

/* ── Governance Events ─────────────────────────────────── */

export interface CampusLockedPayload {
  campusId: number;
  financial: boolean;
  academic: boolean;
  reason?: string;
}

export interface CampusUnlockedPayload {
  campusId: number;
}

export interface ControlPolicyChangedPayload {
  domain: string;
  oldMode: string;
  newMode: string;
}

export interface CampusHealthRefreshedPayload {
  campusCount: number;
  criticalCount: number;
  highRiskCount: number;
}

/* ── System Events ─────────────────────────────────────── */

export interface JobFailedPayload {
  jobId: string;
  jobType: string;
  queue: string;
  error: string;
  attempts: number;
}

export interface ReportGeneratedPayload {
  jobId: string;
  reportType: string;
  resultUrl?: string;
}

/* ── Event Type Constants ──────────────────────────────── */

export const EventTypes = {
  // Finance
  PAYMENT_RECEIVED: "PaymentReceived",
  PAYMENT_RECONCILED: "PaymentReconciled",
  PAYMENT_REVERSED: "PaymentReversed",
  CHALLAN_CREATED: "ChallanCreated",
  FEE_POSTING_COMPLETED: "FeePostingCompleted",
  FEE_POSTING_FAILED: "FeePostingFailed",

  // Academic
  STUDENT_ENROLLED: "StudentEnrolled",
  STUDENT_PROMOTED: "StudentPromoted",
  STUDENT_WITHDRAWN: "StudentWithdrawn",
  STUDENT_TRANSFERRED: "StudentTransferred",
  ACADEMIC_YEAR_CLOSED: "AcademicYearClosed",
  ACADEMIC_YEAR_ACTIVATED: "AcademicYearActivated",
  EXAM_PUBLISHED: "ExamPublished",
  PROMOTION_RUN_COMPLETED: "PromotionRunCompleted",

  // Notification
  REMINDER_RUN_COMPLETED: "ReminderRunCompleted",

  // Adoption
  OTP_REQUESTED: "OtpRequested",
  PHONE_LOGIN_COMPLETED: "PhoneLoginCompleted",
  QR_TOKEN_GENERATED: "QrTokenGenerated",
  QR_TOKEN_RESOLVED: "QrTokenResolved",
  PARENT_ACCESS_CREATED: "ParentAccessCreated",
  WIZARD_STEP_COMPLETED: "WizardStepCompleted",
  ORGANIZATION_BOOTSTRAPPED: "OrganizationBootstrapped",
  PAYMENT_INITIATED: "PaymentInitiated",
  WEBHOOK_PROCESSED: "WebhookProcessed",
  REMINDER_SENT: "ReminderSent",

  // Governance
  CAMPUS_LOCKED: "CampusLocked",
  CAMPUS_UNLOCKED: "CampusUnlocked",
  CONTROL_POLICY_CHANGED: "ControlPolicyChanged",
  CAMPUS_HEALTH_REFRESHED: "CampusHealthRefreshed",

  // System
  JOB_FAILED: "JobFailed",
  REPORT_GENERATED: "ReportGenerated",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/* ── Type Map (event type → payload) ───────────────────── */

export interface EventPayloadMap {
  PaymentReceived: PaymentReceivedPayload;
  PaymentReconciled: PaymentReconciledPayload;
  PaymentReversed: PaymentReversedPayload;
  ChallanCreated: ChallanCreatedPayload;
  FeePostingCompleted: FeePostingCompletedPayload;
  FeePostingFailed: FeePostingFailedPayload;
  StudentEnrolled: StudentEnrolledPayload;
  StudentPromoted: StudentPromotedPayload;
  StudentWithdrawn: StudentWithdrawnPayload;
  StudentTransferred: StudentTransferredPayload;
  AcademicYearClosed: AcademicYearClosedPayload;
  AcademicYearActivated: AcademicYearActivatedPayload;
  ExamPublished: ExamPublishedPayload;
  PromotionRunCompleted: PromotionRunCompletedPayload;
  ReminderRunCompleted: ReminderRunCompletedPayload;
  OtpRequested: OtpRequestedPayload;
  PhoneLoginCompleted: PhoneLoginCompletedPayload;
  QrTokenGenerated: QrTokenGeneratedPayload;
  QrTokenResolved: QrTokenResolvedPayload;
  ParentAccessCreated: ParentAccessCreatedPayload;
  WizardStepCompleted: WizardStepCompletedPayload;
  OrganizationBootstrapped: OrganizationBootstrappedPayload;
  PaymentInitiated: PaymentInitiatedPayload;
  WebhookProcessed: WebhookProcessedPayload;
  ReminderSent: ReminderSentPayload;
  CampusLocked: CampusLockedPayload;
  CampusUnlocked: CampusUnlockedPayload;
  ControlPolicyChanged: ControlPolicyChangedPayload;
  CampusHealthRefreshed: CampusHealthRefreshedPayload;
  JobFailed: JobFailedPayload;
  ReportGenerated: ReportGeneratedPayload;
}

/* ── Handler Registration Types ────────────────────────── */

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

export interface HandlerRegistration {
  eventType: string;
  handlerName: string;
  handler: EventHandler;
  async: boolean;
}
