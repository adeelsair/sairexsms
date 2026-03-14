import PDFDocument from "pdfkit";

export interface ReceiptPayload {
  schoolName: string;
  invoiceNumber: string;
  amount: number;
  paidAt: Date;
  transactionId: string;
  provider: string;
}

export async function generateReceiptPdf(payload: ReceiptPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).text(payload.schoolName, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(14).text("Payment Receipt");
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Invoice: ${payload.invoiceNumber}`);
    doc.text(`Amount: PKR ${payload.amount.toLocaleString()}`);
    doc.text(`Provider: ${payload.provider}`);
    doc.text(`Transaction ID: ${payload.transactionId}`);
    doc.text(`Paid At: ${payload.paidAt.toISOString()}`);
    doc.moveDown(2);
    doc.text("This is a system-generated receipt.", { align: "left" });

    doc.end();
  });
}
