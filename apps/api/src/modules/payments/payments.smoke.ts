import { app } from "../../app";
import { PrismaClient } from "../../../../../web/lib/generated/prisma";
import { startPaymentWorker } from "../../workers/payment.worker";
import { paymentQueue } from "./queue/payment.queue";
import { redis } from "../../lib/redis";

const prisma = new PrismaClient();

async function waitForInvoiceStatus(invoiceId: string, expected: string, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`http://127.0.0.1:4010/payments/invoice/${invoiceId}/status`);
    const body = await res.json();
    if (body?.status === expected) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function main() {
  const worker = startPaymentWorker();
  const server = app.listen(4010);

  try {
    const invoiceNumber = `INV-${Date.now()}`;

    const createRes = await fetch("http://127.0.0.1:4010/payments/invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        schoolId: "school1",
        studentId: "student1",
        amount: 12500,
        dueDate: "2026-04-10T00:00:00.000Z",
      }),
    });
    const createdInvoice = await createRes.json();
    console.log("createStatus", createRes.status, "invoiceStatus", createdInvoice.status);

    const providerRes = await fetch(
      `http://127.0.0.1:4010/payments/invoice/${createdInvoice.id}/provider/1BILL`,
      {
        method: "POST",
      },
    );
    const providerBody = await providerRes.json();
    console.log("providerEndpoint", providerRes.status, providerBody.billId);

    const txnId = `TX-${Date.now()}`;
    const webhookRes = await fetch("http://127.0.0.1:4010/payments/webhook/1BILL", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txn: txnId,
        invoiceId: createdInvoice.id,
        amount: 12500,
      }),
    });
    const webhookBody = await webhookRes.json();
    console.log("webhookStatus", webhookRes.status, webhookBody.status ?? webhookBody.error);

    const partialInvoiceRes = await fetch("http://127.0.0.1:4010/payments/invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: `INV-PARTIAL-${Date.now()}`,
        schoolId: "school1",
        studentId: "student1",
        amount: 10000,
        dueDate: "2026-04-10T00:00:00.000Z",
      }),
    });
    const partialInvoice = await partialInvoiceRes.json();

    const partialWebhookRes = await fetch("http://127.0.0.1:4010/payments/webhook/1BILL", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txn: `TX-PARTIAL-${Date.now()}`,
        invoiceId: partialInvoice.id,
        amount: 3000,
      }),
    });
    const partialWebhookBody = await partialWebhookRes.json();
    const partialStatusBody = await waitForInvoiceStatus(partialInvoice.id, "PARTIAL");
    console.log("partialFlow", partialWebhookRes.status, partialWebhookBody.status ?? partialWebhookBody.error, partialStatusBody?.status, partialStatusBody?.amountPaid);

    const duplicateWebhookRes = await fetch("http://127.0.0.1:4010/payments/webhook/1BILL", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txn: txnId,
        invoiceId: createdInvoice.id,
        amount: 12500,
      }),
    });
    const duplicateWebhookBody = await duplicateWebhookRes.json();
    console.log("duplicateWebhookStatus", duplicateWebhookRes.status, duplicateWebhookBody.status ?? duplicateWebhookBody.error);

    const invoiceStatus = await waitForInvoiceStatus(createdInvoice.id, "PAID");
    console.log("statusEndpoint", invoiceStatus ? 200 : 500, invoiceStatus?.status);

    const latestPayment = await prisma.payment.findFirst({
      where: { invoiceId: createdInvoice.id },
      orderBy: { createdAt: "desc" },
      select: { transactionId: true, status: true },
    });
    console.log("latestPayment", latestPayment?.transactionId, latestPayment?.status);

    const latestEvent = await prisma.paymentEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { event: true },
    });
    console.log("latestEvent", latestEvent?.event);

    const metricsRes = await fetch("http://127.0.0.1:4010/payments/metrics");
    const metricsBody = await metricsRes.json();
    console.log("metricsStatus", metricsRes.status, metricsBody.totalInvoices, metricsBody.totalRevenue);

    const publicInvoiceRes = await fetch(
      `http://127.0.0.1:4010/payments/public/invoice/${encodeURIComponent(createdInvoice.invoiceNumber)}`,
    );
    const publicInvoiceBody = await publicInvoiceRes.json();
    console.log(
      "publicInvoiceStatus",
      publicInvoiceRes.status,
      publicInvoiceBody.invoiceNumber,
      Boolean(publicInvoiceBody.qrDataUrl),
    );

    const publicStatusRes = await fetch(
      `http://127.0.0.1:4010/payments/public/invoice/${encodeURIComponent(createdInvoice.invoiceNumber)}/status`,
    );
    const publicStatusBody = await publicStatusRes.json();
    console.log("publicStatus", publicStatusRes.status, publicStatusBody.status);

    const receiptRes = await fetch(`http://127.0.0.1:4010/payments/receipt/${createdInvoice.id}`);
    const receiptBody = await receiptRes.json();
    console.log("receiptStatus", receiptRes.status, receiptBody.transactionId, receiptBody.provider);

    const schoolConfigUpsertRes = await fetch(
      "http://127.0.0.1:4010/payments/school-config/school1",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bankName: "HBL",
          accountTitle: "Demo School",
          accountNumber: "1234567890",
          providerMerchantId: "MERCHANT-001",
        }),
      },
    );
    const schoolConfigBody = await schoolConfigUpsertRes.json();
    console.log("schoolConfig", schoolConfigUpsertRes.status, schoolConfigBody.schoolId);

    const paymentForRefund = await prisma.payment.findFirst({
      where: { invoiceId: createdInvoice.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (paymentForRefund?.id) {
      const refundRes = await fetch(
        `http://127.0.0.1:4010/payments/refund/${paymentForRefund.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount: 12500, reason: "Test refund" }),
        },
      );
      const refundBody = await refundRes.json();
      console.log("refundStatus", refundRes.status, refundBody.status);
    }

    const analyticsRes = await fetch("http://127.0.0.1:4010/payments/analytics");
    const analyticsBody = await analyticsRes.json();
    console.log("analytics", analyticsRes.status, analyticsBody.totalRevenue, analyticsBody.lateInvoices);

    const alertsRes = await fetch("http://127.0.0.1:4010/payments/alerts?hours=24");
    const alertsBody = await alertsRes.json();
    console.log("alerts", alertsRes.status, Array.isArray(alertsBody.alerts));

    const queueStatsRes = await fetch("http://127.0.0.1:4010/payments/queue-stats");
    const queueStatsBody = await queueStatsRes.json();
    console.log("queueStats", queueStatsRes.status, queueStatsBody.waiting, queueStatsBody.failed);
  } finally {
    await worker.close();
    await paymentQueue.close();
    await redis.quit();
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

