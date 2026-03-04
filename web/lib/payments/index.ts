export type {
  PaymentGatewayAdapter,
  CreateSessionInput,
  PaymentSessionResult,
  NormalizedPayment,
  GatewayConfig,
} from "./gateway.interface";

export {
  initiatePayment,
  processWebhook,
  resolveGatewayAdapter,
  getPaymentConfig,
  savePaymentConfig,
  PaymentServiceError,
} from "./payment.service";
export type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  ProcessWebhookInput,
  ProcessWebhookResult,
  SavePaymentConfigInput,
} from "./payment.service";
