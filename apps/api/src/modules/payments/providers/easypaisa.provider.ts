import type { PaymentProviderInterface } from "./provider.interface";

export class EasypaisaProvider implements PaymentProviderInterface {
  initialize(_config?: any): void {}

  async createBill(data: {
    invoiceId: string;
    amount: number;
    currency: string;
    customerName?: string;
  }): Promise<{ reference: string }> {
    return {
      reference: `MOCKEASYPAISA-${data.invoiceId}`,
    };
  }

  async verifyPayment(_data: unknown): Promise<boolean> {
    return true;
  }

  async parseWebhook(payload: unknown): Promise<{
    transactionId: string;
    invoiceRef: string;
    amount: number;
    status: string;
  }> {
    const data = (payload ?? {}) as Record<string, unknown>;
    return {
      transactionId: String(data.txn ?? data.transactionId ?? ""),
      invoiceRef: String(data.invoiceId ?? data.invoiceRef ?? ""),
      amount: Number(data.amount ?? 0),
      status: "PAID",
    };
  }
}

