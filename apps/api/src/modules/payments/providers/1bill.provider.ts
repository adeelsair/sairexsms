import type { PaymentProviderInterface } from "./provider.interface";
import axios from "axios";
import { paymentsConfig } from "../../../config/payments.config";

export class OneBillProvider implements PaymentProviderInterface {
  private config = paymentsConfig.onebill;

  initialize(config?: any): void {
    if (!config || typeof config !== "object") return;
    this.config = { ...this.config, ...config };
  }

  async createBill(data: {
    invoiceId: string;
    amount: number;
    currency: string;
    customerName?: string;
  }): Promise<{ reference: string }> {
    if (!this.config.merchantId || !this.config.apiKey) {
      return { reference: `MOCK1BILL-${data.invoiceId}` };
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await axios.post(
          `${this.config.baseUrl}/createBill`,
          {
            merchantId: this.config.merchantId,
            invoiceNumber: data.invoiceId,
            amount: data.amount,
            currency: data.currency,
          },
          {
            headers: { Authorization: `Bearer ${this.config.apiKey}` },
            timeout: 15000,
          },
        );

        return { reference: String(response.data?.billId ?? `MOCK1BILL-${data.invoiceId}`) };
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("1Bill createBill failed");
  }

  async verifyPayment(data: any): Promise<boolean> {
    if (!this.config.apiKey) return true;
    const transactionId = String(data?.transactionId ?? "");
    if (!transactionId) return false;

    const response = await axios.get(
      `${this.config.baseUrl}/verify/${transactionId}`,
      {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        timeout: 15000,
      },
    );
    return String(response.data?.status ?? "").toUpperCase() === "PAID";
  }

  async parseWebhook(payload: any): Promise<{
    transactionId: string;
    invoiceRef: string;
    amount: number;
    status: string;
  }> {
    return {
      transactionId: String(payload?.transactionId ?? payload?.txn ?? ""),
      invoiceRef: String(payload?.invoiceNumber ?? payload?.invoiceId ?? payload?.invoiceRef ?? ""),
      amount: Number(payload?.amount ?? 0),
      status: String(payload?.status ?? "PAID").toUpperCase(),
    };
  }
}

