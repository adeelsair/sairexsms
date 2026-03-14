import { Router } from "express";
import { PaymentsService } from "./payments.service";
import { paymentWebhook } from "./webhooks/payment.webhook";
import { PaymentProvider } from "./payments.types";
import { generateInvoiceQR } from "./utils/qr.generator";
import { generateCode128PngDataUrl } from "./utils/barcode.generator";
import { generateReceiptPdf } from "./receipts/receipt.generator";
import { paymentQueue } from "./queue/payment.queue";

const router = Router();
const service = new PaymentsService();

interface PublicInvoiceResponse {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: Date;
  billId: string | null;
  paymentUrl: string;
  qrDataUrl: string;
  barcodeDataUrl: string | null;
}

function isPaymentProvider(value: string): value is PaymentProvider {
  return Object.values(PaymentProvider).includes(value as PaymentProvider);
}

router.post("/invoice", async (req, res) => {
  try {
    const invoice = await service.createInvoice(req.body);

    const provider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
    if (provider && isPaymentProvider(provider)) {
      const bill = await service.createProviderBill(provider, {
        id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
      });

      await service.sendInvoiceCreatedSms({
        to: typeof req.body?.recipientPhone === "string" ? req.body.recipientPhone : undefined,
        studentName: typeof req.body?.studentName === "string" ? req.body.studentName : undefined,
        amount: invoice.amount,
        billId: String((bill as { reference?: unknown }).reference ?? ""),
        invoiceNumber: invoice.invoiceNumber,
      });

      res.json({
        invoiceId: invoice.id,
        provider,
        billId: String((bill as { reference?: unknown }).reference ?? ""),
      });
      return;
    }

    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    res.status(500).json({ error: message });
  }
});

router.get("/invoice/:id", async (req, res) => {
  try {
    const invoice = await service.getInvoice(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoice";
    res.status(500).json({ error: message });
  }
});

router.get("/invoice/:id/status", async (req, res) => {
  try {
    const invoice = await service.getInvoiceStatus(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoice status";
    res.status(500).json({ error: message });
  }
});

router.post("/invoice/:id/provider/:provider", async (req, res) => {
  try {
    const { id, provider } = req.params;
    if (!isPaymentProvider(provider)) {
      res.status(400).json({ error: "Unsupported payment provider" });
      return;
    }

    const invoice = await service.getInvoice(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const bill = await service.createProviderBill(provider, {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
    });

    res.json({
      provider,
      billId: String((bill as { reference?: unknown }).reference ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create provider bill";
    res.status(500).json({ error: message });
  }
});

router.post("/webhook/:provider", paymentWebhook);

router.get("/public/invoice/:invoiceNumber", async (req, res) => {
  try {
    const invoice = await service.getInvoiceByNumber(req.params.invoiceNumber);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const paymentUrl = service.buildPublicInvoiceUrl(invoice.invoiceNumber);
    const qrDataUrl = await generateInvoiceQR(paymentUrl);
    const barcodeDataUrl = invoice.providerRef
      ? await generateCode128PngDataUrl(String(invoice.providerRef))
      : null;

    const payload: PublicInvoiceResponse = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      billId: invoice.providerRef ?? null,
      paymentUrl,
      qrDataUrl,
      barcodeDataUrl,
    };

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public invoice";
    res.status(500).json({ error: message });
  }
});

router.get("/public/invoice/:invoiceNumber/status", async (req, res) => {
  try {
    const invoice = await service.getInvoiceStatusByNumber(req.params.invoiceNumber);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load invoice status";
    res.status(500).json({ error: message });
  }
});

router.post("/public/invoice/:invoiceNumber/provider/:provider", async (req, res) => {
  try {
    const provider = req.params.provider as PaymentProvider;
    if (!isPaymentProvider(provider)) {
      res.status(400).json({ error: "Unsupported payment provider" });
      return;
    }

    const invoice = await service.getInvoiceByNumber(req.params.invoiceNumber);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const bill = await service.createProviderBill(provider, {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
    });

    const billId = String((bill as { reference?: unknown }).reference ?? "");
    res.json({
      invoiceNumber: invoice.invoiceNumber,
      provider,
      billId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize provider payment";
    res.status(500).json({ error: message });
  }
});

router.get("/metrics", async (_req, res) => {
  try {
    const metrics = await service.getPaymentMetrics();
    res.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment metrics";
    res.status(500).json({ error: message });
  }
});

router.get("/analytics", async (_req, res) => {
  try {
    const analytics = await service.getPaymentAnalytics();
    res.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment analytics";
    res.status(500).json({ error: message });
  }
});

router.get("/school-config/:schoolId", async (req, res) => {
  try {
    const config = await service.getSchoolPaymentConfig(req.params.schoolId);
    if (!config) {
      res.status(404).json({ error: "School payment config not found" });
      return;
    }
    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load school payment config";
    res.status(500).json({ error: message });
  }
});

router.put("/school-config/:schoolId", async (req, res) => {
  try {
    const config = await service.upsertSchoolPaymentConfig({
      schoolId: req.params.schoolId,
      bankName: typeof req.body?.bankName === "string" ? req.body.bankName : null,
      accountTitle: typeof req.body?.accountTitle === "string" ? req.body.accountTitle : null,
      accountNumber: typeof req.body?.accountNumber === "string" ? req.body.accountNumber : null,
      providerMerchantId:
        typeof req.body?.providerMerchantId === "string"
          ? req.body.providerMerchantId
          : null,
    });
    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update school payment config";
    res.status(500).json({ error: message });
  }
});

router.get("/receipt/:invoiceId", async (req, res) => {
  try {
    const receipt = await service.getReceiptByInvoiceId(req.params.invoiceId);
    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }
    res.json({
      invoice: receipt.invoiceNumber,
      amount: receipt.amount,
      paidAt: receipt.paidAt.toISOString(),
      transactionId: receipt.transactionId,
      provider: receipt.provider,
      status: receipt.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load receipt";
    res.status(500).json({ error: message });
  }
});

router.get("/receipt/:invoiceId/pdf", async (req, res) => {
  try {
    const receipt = await service.getReceiptByInvoiceId(req.params.invoiceId);
    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    const pdf = await generateReceiptPdf({
      schoolName: "SairexSMS School",
      invoiceNumber: receipt.invoiceNumber,
      amount: receipt.amount,
      paidAt: receipt.paidAt,
      transactionId: receipt.transactionId,
      provider: receipt.provider,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${receipt.invoiceNumber}.pdf"`,
    );
    res.send(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate receipt PDF";
    res.status(500).json({ error: message });
  }
});

router.post("/refund/:paymentId", async (req, res) => {
  try {
    const amount = Number(req.body?.amount ?? 0);
    const reason = String(req.body?.reason ?? "").trim();
    if (!amount || !reason) {
      res.status(400).json({ error: "amount and reason are required" });
      return;
    }

    const refund = await service.createRefund({
      paymentId: req.params.paymentId,
      amount,
      reason,
    });
    res.json(refund);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process refund";
    res.status(500).json({ error: message });
  }
});

router.get("/invoices", async (_req, res) => {
  try {
    const invoices = await service.listInvoices();
    res.json(invoices);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load invoices";
    res.status(500).json({ error: message });
  }
});

router.get("/payments", async (_req, res) => {
  try {
    const payments = await service.listPayments();
    res.json(payments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payments";
    res.status(500).json({ error: message });
  }
});

router.get("/refunds", async (_req, res) => {
  try {
    const refunds = await service.listRefunds();
    res.json(refunds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load refunds";
    res.status(500).json({ error: message });
  }
});

router.get("/reconciliation", async (_req, res) => {
  try {
    const summary = await service.getReconciliationOverview();
    res.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reconciliation summary";
    res.status(500).json({ error: message });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const hours = Number(req.query.hours ?? 24);
    const alerts = await service.getPaymentAlerts(Number.isFinite(hours) ? hours : 24);
    res.json({ hours: Number.isFinite(hours) ? hours : 24, alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment alerts";
    res.status(500).json({ error: message });
  }
});

router.get("/queue-stats", async (_req, res) => {
  try {
    const stats = await paymentQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
    res.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load queue stats";
    res.status(500).json({ error: message });
  }
});

router.post("/provider-check/:provider", async (req, res) => {
  try {
    const providerRaw = String(req.params.provider ?? "").toUpperCase();
    if (providerRaw !== "BANK" && !isPaymentProvider(providerRaw)) {
      res.status(400).json({ error: "Unsupported provider for check" });
      return;
    }

    const schoolId = String(req.body?.schoolId ?? "").trim();
    const mode = String(req.body?.mode ?? "AUTO").toUpperCase();
    if (!schoolId) {
      res.status(400).json({ error: "schoolId is required" });
      return;
    }
    if (mode !== "AUTO" && mode !== "MANUAL") {
      res.status(400).json({ error: "mode must be AUTO or MANUAL" });
      return;
    }

    if (mode === "MANUAL") {
      await service.upsertSchoolPaymentConfig({
        schoolId,
        bankName: typeof req.body?.bankName === "string" ? req.body.bankName : null,
        accountTitle: typeof req.body?.accountTitle === "string" ? req.body.accountTitle : null,
        accountNumber: typeof req.body?.accountNumber === "string" ? req.body.accountNumber : null,
        providerMerchantId:
          typeof req.body?.providerMerchantId === "string"
            ? req.body.providerMerchantId
            : null,
      });
    }

    const report = await service.checkProviderConnectivity({
      schoolId,
      provider: providerRaw === "BANK" ? "BANK" : (providerRaw as PaymentProvider),
      mode: mode as "AUTO" | "MANUAL",
    });
    res.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider check failed";
    res.status(500).json({ error: message });
  }
});

export default router;

