export interface PaymentProviderInterface {
  initialize(config?: any): void;

  createBill(data: {
    invoiceId: string;
    amount: number;
    currency: string;
    customerName?: string;
  }): Promise<unknown>;

  verifyPayment(data: unknown): Promise<boolean>;

  parseWebhook(payload: unknown): Promise<{
    transactionId: string;
    invoiceRef: string;
    amount: number;
    status: string;
  }>;
}

