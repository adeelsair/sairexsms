import { PaymentsService } from "../payments.service";
import { PaymentProvider } from "../payments.types";
import { ProviderRegistry } from "../providers/provider.registry";
import { paymentsConfig } from "../../../config/payments.config";
import { verifySignature } from "../security/webhook.verifier";

const service = new PaymentsService();

export interface ProcessPaymentWebhookInput {
  provider: PaymentProvider;
  payload: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

export async function processPaymentWebhook(input: ProcessPaymentWebhookInput) {
  const providerImpl = ProviderRegistry.get(input.provider);
  providerImpl.initialize();

  if (input.provider === PaymentProvider.ONEBILL && paymentsConfig.onebill.webhookSecret) {
    const signatureHeader =
      input.headers?.["x-onebill-signature"] ??
      input.headers?.["x-signature"] ??
      "";
    const signature = Array.isArray(signatureHeader)
      ? String(signatureHeader[0] ?? "")
      : String(signatureHeader ?? "");

    const isValid = verifySignature(
      input.payload,
      signature,
      String(paymentsConfig.onebill.webhookSecret),
    );
    if (!isValid) {
      await service.logEvent("webhook_failure", {
        provider: input.provider,
        payload: input.payload,
        reason: "invalid_signature",
      });
      throw new Error("Invalid webhook signature");
    }
  }

  await service.logEvent("webhook_received", {
    provider: input.provider,
    payload: input.payload,
  });

  const parsed = await providerImpl.parseWebhook(input.payload);
  const existingPayment = await service.findPaymentByTransactionId(parsed.transactionId);
  if (existingPayment) {
    await service.logEvent("duplicate_webhook", { provider: input.provider, parsed }, existingPayment.id);
    return { status: "already_processed", paymentId: existingPayment.id };
  }

  const verified = await providerImpl.verifyPayment({
    transactionId: parsed.transactionId,
    payload: input.payload,
  });
  if (!verified) {
    await service.logEvent("payment_verification_failed", { provider: input.provider, parsed });
    throw new Error("Payment verification failed");
  }

  const payment = await service.recordPayment({
    invoiceId: parsed.invoiceRef,
    provider: input.provider,
    transactionId: parsed.transactionId,
    amount: parsed.amount,
    status: parsed.status,
    paidAt: parsed.status === "PAID" ? new Date() : null,
  });

  if (parsed.status === "PAID") {
    await service.applyPaymentToInvoice(parsed.invoiceRef, parsed.amount);
    await service.addLedgerEntry({
      type: "payment_received",
      amount: parsed.amount,
      referenceType: "payment",
      referenceId: payment.id,
      payload: {
        invoiceId: parsed.invoiceRef,
        provider: input.provider,
        transactionId: parsed.transactionId,
      },
    });
    if (typeof input.payload === "object" && input.payload !== null) {
      const record = input.payload as Record<string, unknown>;
      await service.sendPaymentReceivedSms({
        to: String(record.recipientPhone ?? record.phone ?? ""),
        invoiceId: parsed.invoiceRef,
        amount: parsed.amount,
      });
    }
  }

  await service.logEvent("webhook_processed", { provider: input.provider, parsed }, payment.id);

  return { status: "processed", paymentId: payment.id };
}
