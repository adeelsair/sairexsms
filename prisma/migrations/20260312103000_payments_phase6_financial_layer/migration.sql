-- Phase P6 financial layer

ALTER TABLE "Invoice"
  ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lateFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lateFeeApplied" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Invoice_schoolId_status_idx" ON "Invoice"("schoolId", "status");
CREATE INDEX "Invoice_dueDate_status_idx" ON "Invoice"("dueDate", "status");

CREATE TABLE "SchoolPaymentConfig" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "bankName" TEXT,
  "accountTitle" TEXT,
  "accountNumber" TEXT,
  "providerMerchantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolPaymentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolPaymentConfig_schoolId_key" ON "SchoolPaymentConfig"("schoolId");

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");

CREATE TABLE "PaymentLedgerEntry" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentLedgerEntry_type_createdAt_idx" ON "PaymentLedgerEntry"("type", "createdAt");
CREATE INDEX "PaymentLedgerEntry_referenceType_referenceId_idx" ON "PaymentLedgerEntry"("referenceType", "referenceId");
CREATE INDEX "Payment_invoiceId_createdAt_idx" ON "Payment"("invoiceId", "createdAt");

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_paymentId_fkey"
  FOREIGN KEY ("paymentId")
  REFERENCES "Payment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
