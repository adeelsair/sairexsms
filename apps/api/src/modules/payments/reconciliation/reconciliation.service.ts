import { PrismaClient } from "../../../../../../web/lib/generated/prisma";
import { PaymentProvider } from "../payments.types";
import { ProviderRegistry } from "../providers/provider.registry";

const prisma = new PrismaClient();

export class ReconciliationService {
  async reconcileProvider(provider: PaymentProvider) {
    const payments = await prisma.payment.findMany({
      where: { provider },
      select: { id: true, transactionId: true, invoiceId: true, amount: true },
    });

    const providerImpl = ProviderRegistry.get(provider);
    providerImpl.initialize();

    for (const payment of payments) {
      try {
        const verified = await providerImpl.verifyPayment({
          transactionId: payment.transactionId,
        });

        if (!verified) {
          await prisma.paymentEvent.create({
            data: {
              paymentId: payment.id,
              event: "reconciliation_mismatch",
              payload: {
                provider,
                transactionId: payment.transactionId,
                invoiceId: payment.invoiceId,
                amount: payment.amount,
              },
            },
          });
        }
      } catch (error) {
        await prisma.paymentEvent.create({
          data: {
            paymentId: payment.id,
            event: "reconciliation_error",
            payload: {
              provider,
              transactionId: payment.transactionId,
              invoiceId: payment.invoiceId,
              error: error instanceof Error ? error.message : "Unknown reconciliation error",
            },
          },
        });
      }
    }
  }
}

