export {
  requestOtp,
  verifyOtp,
  cleanupExpiredSessions,
  OtpError,
} from "./otp.service";
export type { RequestOtpInput, RequestOtpResult, VerifyOtpInput, VerifyOtpResult } from "./otp.service";

export {
  generateQrToken,
  bulkGenerateQrTokens,
  resolveQrToken,
  consumeQrToken,
  resolveFeePaymentQr,
  resolveParentAccessQr,
  listQrTokens,
  cleanupExpiredTokens,
  QrTokenError,
} from "./qr-token.service";
export type { GenerateQrInput, GenerateQrResult, ResolvedQrToken } from "./qr-token.service";

export {
  getWizardProgress,
  completeWizardStep,
  skipWizardStep,
  resetWizard,
  WIZARD_STEPS,
  TOTAL_STEPS,
} from "./onboarding.service";
export type { WizardProgress } from "./onboarding.service";

export {
  bootstrapOrganizationSetup,
  CLASS_PRESETS,
  PRESET_LABELS,
} from "./bootstrap.service";
export type {
  BootstrapInput,
  BootstrapResult,
  ClassPresetDef,
  FeePresetInput,
} from "./bootstrap.service";

export {
  getDashboardActions,
  getDashboardStats,
  getDashboardActivity,
} from "./dashboard.service";
export type {
  DashboardActionDef,
  QuickStat,
  ActivityItem,
} from "./dashboard.service";
