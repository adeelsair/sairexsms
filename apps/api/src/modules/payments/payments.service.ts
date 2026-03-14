import { PrismaClient } from "../../../../../web/lib/generated/prisma";
import { InvoiceStatus, PaymentProvider } from "./payments.types";
import { ProviderRegistry } from "./providers/provider.registry";
import { assertInvoiceStatusTransition } from "./state/invoice.state";

const prisma = new PrismaClient();

export class PaymentsService {
  private asInvoiceStatus(status: string): InvoiceStatus {
    const normalized = String(status ?? "").toUpperCase();
    if (Object.values(InvoiceStatus).includes(normalized as InvoiceStatus)) {
      return normalized as InvoiceStatus;
    }
    throw new Error(`Unknown invoice status: ${status}`);
  }

  async createInvoice(data: {
    schoolId: string;
    studentId: string;
    invoiceNumber: string;
    amount: number;
    amountPaid?: number;
    lateFee?: number;
    lateFeeApplied?: boolean;
    currency?: string;
    status?: string;
    provider?: string;
    providerRef?: string;
    dueDate: string | Date;
    paidAt?: string | Date | null;
  }) {
    const invoice = await prisma.invoice.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
      },
    });
    await this.addLedgerEntry({
      type: "invoice_created",
      amount: invoice.amount,
      referenceType: "invoice",
      referenceId: invoice.id,
      payload: { invoiceNumber: invoice.invoiceNumber, schoolId: invoice.schoolId },
    });
    return invoice;
  }

  async getInvoice(invoiceId: string) {
    return prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    return prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
  }

  async recordPayment(data: {
    invoiceId: string;
    provider: string;
    transactionId: string;
    amount: number;
    status: string;
    paidAt?: string | Date | null;
  }) {
    const existing = await prisma.payment.findUnique({
      where: { transactionId: data.transactionId },
    });

    if (existing) {
      return existing;
    }

    return prisma.payment.create({
      data: {
        ...data,
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
      },
    });
  }

  async markInvoicePaid(invoiceId: string) {
    const snapshot = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { amount: true, lateFee: true, status: true },
    });
    if (!snapshot) {
      throw new Error("Invoice not found");
    }
    const currentStatus = this.asInvoiceStatus(snapshot.status);
    assertInvoiceStatusTransition(currentStatus, InvoiceStatus.PAID);

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        amountPaid: snapshot.amount + snapshot.lateFee,
        paidAt: new Date(),
      },
    });
  }

  async applyPaymentToInvoice(invoiceId: string, paymentAmount: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        amount: true,
        amountPaid: true,
        lateFee: true,
        status: true,
        paidAt: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const newAmountPaid = invoice.amountPaid + paymentAmount;
    const totalDue = invoice.amount + invoice.lateFee;
    const isFullyPaid = newAmountPaid >= totalDue;
    const nextStatus =
      isFullyPaid
        ? InvoiceStatus.PAID
        : newAmountPaid > 0
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.PENDING;
    assertInvoiceStatusTransition(this.asInvoiceStatus(invoice.status), nextStatus);

    return prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        status: nextStatus,
        paidAt: isFullyPaid ? new Date() : invoice.paidAt,
      },
    });
  }

  async createProviderBill(provider: PaymentProvider, invoice: {
    id: string;
    amount: number;
    currency: string;
  }) {
    const providerImpl = ProviderRegistry.get(provider);
    providerImpl.initialize();

    let bill: unknown;
    try {
      bill = await providerImpl.createBill({
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider API call failed";
      await this.logEvent("provider_api_error", {
        provider,
        invoiceId: invoice.id,
        error: message,
      });
      await this.logEvent("payment_provider_down", {
        provider,
        invoiceId: invoice.id,
        error: message,
      });
      throw error;
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        provider,
        providerRef: String((bill as { reference?: unknown }).reference ?? null),
      },
    });

    return bill;
  }

  async sendInvoiceCreatedSms(data: {
    to?: string;
    studentName?: string;
    amount: number;
    billId: string;
    invoiceNumber?: string;
    paymentLink?: string;
  }) {
    if (!data.to) return;

    const { sendSmsMessage } = await import("../../../../../web/lib/sms");
    const student = data.studentName ?? "Student";
    const paymentLink =
      data.paymentLink ??
      (data.invoiceNumber ? this.buildPublicInvoiceUrl(data.invoiceNumber) : undefined);
    const message = [
      "Fee Invoice Generated",
      "",
      `Student: ${student}`,
      `Amount: PKR ${data.amount.toLocaleString()}`,
      `1Bill ID: ${data.billId}`,
      "",
      ...(paymentLink ? ["Pay here:", paymentLink, ""] : []),
      "Pay via bank app, Easypaisa, JazzCash, or card.",
    ].join("\n");

    await sendSmsMessage(data.to, message);
  }

  async sendPaymentReceivedSms(data: {
    to?: string;
    invoiceId: string;
    amount: number;
  }) {
    if (!data.to) return;

    const { sendSmsMessage } = await import("../../../../../web/lib/sms");
    const message = [
      "Payment received",
      `Invoice: ${data.invoiceId}`,
      `Amount: ${data.amount.toLocaleString()}`,
    ].join("\n");
    await sendSmsMessage(data.to, message);
  }

  async getInvoiceStatus(invoiceId: string) {
    return prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        amountPaid: true,
        lateFee: true,
        paidAt: true,
      },
    });
  }

  async getInvoiceStatusByNumber(invoiceNumber: string) {
    return prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        amountPaid: true,
        lateFee: true,
        paidAt: true,
        providerRef: true,
      },
    });
  }

  async getReceiptByInvoiceId(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!invoice) {
      return null;
    }

    const latestPayment = invoice.payments[0] ?? null;
    if (!latestPayment) {
      return null;
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      paidAt: latestPayment.paidAt ?? invoice.paidAt ?? latestPayment.createdAt,
      transactionId: latestPayment.transactionId,
      provider: latestPayment.provider,
      status: invoice.status,
    };
  }

  buildPublicInvoiceUrl(invoiceNumber: string) {
    const base = (process.env.PAYMENTS_PUBLIC_BASE_URL ?? "https://pay.sairex.com").trim();
    const safeBase = base.replace(/\/+$/, "");
    return `${safeBase}/invoice/${encodeURIComponent(invoiceNumber)}`;
  }

  async findPaymentByTransactionId(transactionId: string) {
    return prisma.payment.findUnique({
      where: { transactionId },
    });
  }

  async getPaymentMetrics() {
    const [totalInvoices, paidInvoices, pendingInvoices, revenueAggregate] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      prisma.invoice.count({ where: { status: InvoiceStatus.PENDING } }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: InvoiceStatus.PAID },
      }),
    ]);

    return {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      totalRevenue: revenueAggregate._sum.amount ?? 0,
    };
  }

  async getPaymentAnalytics() {
    const [baseMetrics, lateInvoices, averageWindow] = await Promise.all([
      this.getPaymentMetrics(),
      prisma.invoice.count({
        where: {
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { not: null },
        },
        select: { createdAt: true, paidAt: true },
      }),
    ]);

    const totalHours = averageWindow.reduce((sum, row) => {
      if (!row.paidAt) return sum;
      return sum + (row.paidAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0);
    const averagePaymentTimeHours =
      averageWindow.length > 0 ? Number((totalHours / averageWindow.length).toFixed(2)) : 0;

    return {
      ...baseMetrics,
      lateInvoices,
      averagePaymentTimeHours,
    };
  }

  async upsertSchoolPaymentConfig(data: {
    schoolId: string;
    bankName?: string | null;
    accountTitle?: string | null;
    accountNumber?: string | null;
    providerMerchantId?: string | null;
  }) {
    return prisma.schoolPaymentConfig.upsert({
      where: { schoolId: data.schoolId },
      create: data,
      update: data,
    });
  }

  async getSchoolPaymentConfig(schoolId: string) {
    return prisma.schoolPaymentConfig.findUnique({
      where: { schoolId },
    });
  }

  async checkProviderConnectivity(input: {
    schoolId: string;
    provider: PaymentProvider | "BANK";
    mode: "AUTO" | "MANUAL";
  }) {
    const config = await this.getSchoolPaymentConfig(input.schoolId);
    const checks: Array<{ key: string; status: "PASS" | "WARN" | "FAIL"; message: string }> = [];

    if (!config) {
      checks.push({
        key: "school_config",
        status: "FAIL",
        message: "School payment config is missing",
      });
    } else {
      checks.push({
        key: "school_config",
        status: "PASS",
        message: "School payment config found",
      });
    }

    const hasBankFields = Boolean(
      config?.bankName?.trim() && config?.accountTitle?.trim() && config?.accountNumber?.trim(),
    );
    checks.push({
      key: "bank_account",
      status: hasBankFields ? "PASS" : "WARN",
      message: hasBankFields
        ? "Bank account profile is configured"
        : "Bank details are incomplete",
    });

    if (input.provider !== "BANK") {
      const hasMerchant = Boolean(config?.providerMerchantId?.trim());
      checks.push({
        key: "merchant_profile",
        status: hasMerchant ? "PASS" : "WARN",
        message: hasMerchant
          ? "Provider merchant profile exists"
          : "Provider merchant ID is missing",
      });
    }

    if (input.provider === PaymentProvider.ONEBILL) {
      const oneBillReady = Boolean(
        process.env.ONEBILL_API_KEY?.trim() &&
        process.env.ONEBILL_MERCHANT_ID?.trim() &&
        process.env.ONEBILL_BASE_URL?.trim(),
      );
      checks.push({
        key: "provider_runtime",
        status: oneBillReady ? "PASS" : "FAIL",
        message: oneBillReady
          ? "1Bill runtime credentials are configured"
          : "1Bill credentials are missing in environment",
      });
    } else if (input.provider !== "BANK") {
      checks.push({
        key: "provider_runtime",
        status: "PASS",
        message: `${input.provider} adapter is registered`,
      });
    }

    const hasFail = checks.some((check) => check.status === "FAIL");
    const hasWarn = checks.some((check) => check.status === "WARN");
    const overallStatus = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

    await this.logEvent(
      input.mode === "AUTO" ? "provider_check_auto" : "provider_check_manual",
      {
        schoolId: input.schoolId,
        provider: input.provider,
        mode: input.mode,
        overallStatus,
        checks,
      },
    );

    return {
      schoolId: input.schoolId,
      provider: input.provider,
      mode: input.mode,
      overallStatus,
      checks,
      checkedAt: new Date().toISOString(),
    };
  }

  async createRefund(data: { paymentId: string; amount: number; reason: string }) {
    const payment = await prisma.payment.findUnique({
      where: { id: data.paymentId },
      include: { invoice: true },
    });
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (data.amount <= 0 || data.amount > payment.amount) {
      throw new Error("Refund amount is invalid");
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        amount: data.amount,
        reason: data.reason,
        status: "PROCESSED",
      },
    });

    const updatedInvoice = await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaid: {
          decrement: data.amount,
        },
      },
      select: {
        id: true,
        amount: true,
        amountPaid: true,
        lateFee: true,
        paidAt: true,
        status: true,
      }
    });

    const totalDue = updatedInvoice.amount + updatedInvoice.lateFee;
    const currentStatus = this.asInvoiceStatus(updatedInvoice.status);
    if (currentStatus === InvoiceStatus.PAID && updatedInvoice.amountPaid > 0 && updatedInvoice.amountPaid < totalDue) {
      throw new Error("Refund would violate invoice state machine (PAID -> PARTIAL)");
    }

    const nextStatus =
      currentStatus === InvoiceStatus.PAID && updatedInvoice.amountPaid <= 0
        ? InvoiceStatus.REFUNDED
        : updatedInvoice.amountPaid >= totalDue
          ? InvoiceStatus.PAID
          : updatedInvoice.amountPaid > 0
            ? InvoiceStatus.PARTIAL
            : InvoiceStatus.PENDING;
    assertInvoiceStatusTransition(currentStatus, nextStatus);
    await prisma.invoice.update({
      where: { id: updatedInvoice.id },
      data: {
        status: nextStatus,
        paidAt: nextStatus === InvoiceStatus.PAID ? updatedInvoice.paidAt : null,
      },
    });

    await this.logEvent("refund_processed", {
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      amount: data.amount,
      reason: data.reason,
    }, payment.id);

    await this.addLedgerEntry({
      type: "refund_processed",
      amount: data.amount,
      referenceType: "refund",
      referenceId: refund.id,
      payload: { paymentId: payment.id, invoiceId: payment.invoiceId },
    });

    return refund;
  }

  async listInvoices() {
    return prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listPayments() {
    return prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listRefunds() {
    return prisma.refund.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async getReconciliationOverview() {
    const [totalPayments, paidInvoices, eventCounts] = await Promise.all([
      prisma.payment.count(),
      prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      prisma.paymentEvent.groupBy({
        by: ["event"],
        _count: { event: true },
        where: {
          event: { in: ["reconciliation_mismatch", "duplicate_webhook", "payment_verification_failed"] },
        },
      }),
    ]);

    return {
      totalPayments,
      paidInvoices,
      events: eventCounts.map((entry) => ({
        event: entry.event,
        count: entry._count.event,
      })),
    };
  }

  async applyLateFeesDaily(defaultLateFee = 500) {
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] },
        dueDate: { lt: new Date() },
        lateFeeApplied: false,
      },
      select: {
        id: true,
        invoiceNumber: true,
        schoolId: true,
        amount: true,
        lateFee: true,
      },
      take: 1000,
    });

    let applied = 0;
    for (const invoice of overdueInvoices) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lateFee: invoice.lateFee + defaultLateFee,
          lateFeeApplied: true,
        },
      });
      await this.logEvent("late_fee_added", {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        schoolId: invoice.schoolId,
        lateFee: defaultLateFee,
      });
      await this.addLedgerEntry({
        type: "late_fee_added",
        amount: defaultLateFee,
        referenceType: "invoice",
        referenceId: invoice.id,
        payload: { invoiceNumber: invoice.invoiceNumber },
      });
      applied += 1;
    }

    return { applied };
  }

  async addLedgerEntry(data: {
    type: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    payload?: unknown;
  }) {
    return prisma.paymentLedgerEntry.create({
      data: {
        type: data.type,
        amount: data.amount,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        payload: (data.payload ?? null) as object | null,
      },
    });
  }

  async getPaymentAlerts(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await prisma.paymentEvent.groupBy({
      by: ["event"],
      _count: { event: true },
      where: {
        createdAt: { gte: since },
        event: {
          in: [
            "payment_provider_down",
            "webhook_failure",
            "reconciliation_error",
            "high_failed_payments",
            "provider_api_error",
            "payment_verification_failed",
          ],
        },
      },
    });

    const alerts = rows.map((row) => ({
      event: row.event,
      count: row._count.event,
    }));
    const failedCount =
      alerts.find((entry) => entry.event === "payment_verification_failed")?.count ?? 0;
    if (failedCount >= 10) {
      alerts.push({ event: "high_failed_payments", count: failedCount });
    }
    return alerts;
  }

  async logEvent(event: string, payload: unknown, paymentId?: string) {
    return prisma.paymentEvent.create({
      data: {
        paymentId,
        event,
        payload: payload as object,
      },
    });
  }
}

