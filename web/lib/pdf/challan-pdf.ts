import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface ChallanPdfData {
  challanNo: string;
  issueDate: string;
  dueDate: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  studentName: string;
  admissionNo: string;
  grade: string;
  campusName: string;
  organizationName: string;
}

const COPIES = ["Bank Copy", "School Copy", "Student/Parent Copy"];
const COPY_WIDTH = 180;
const PAGE_MARGIN = 30;
const GAP = 10;

function drawCopy(
  doc: InstanceType<typeof PDFDocument>,
  data: ChallanPdfData,
  copyTitle: string,
  x: number,
  topY: number,
) {
  const col = x;
  let y = topY;

  // Header
  doc.fontSize(9).font("Helvetica-Bold").text(data.organizationName.toUpperCase(), col, y, { width: COPY_WIDTH });
  y += 12;
  doc.fontSize(7).font("Helvetica").text(data.campusName, col, y, { width: COPY_WIDTH });
  y += 14;

  // Copy title banner
  doc.rect(col, y, COPY_WIDTH, 14).fill("#d1d5db");
  doc.fillColor("#000").fontSize(7).font("Helvetica-Bold")
    .text(copyTitle.toUpperCase(), col, y + 3, { width: COPY_WIDTH, align: "center" });
  y += 20;

  // Bank info
  doc.fontSize(6.5).font("Helvetica");
  doc.text("Bank: Habib Bank Limited (HBL)", col, y, { width: COPY_WIDTH });
  y += 9;
  doc.text(`A/C Title: ${data.organizationName} Main Account`, col, y, { width: COPY_WIDTH });
  y += 9;
  doc.text("A/C No: 1234-56789012-03", col, y, { width: COPY_WIDTH });
  y += 14;

  doc.moveTo(col, y).lineTo(col + COPY_WIDTH, y).lineWidth(0.5).stroke();
  y += 6;

  // Student details
  const details = [
    ["Challan No:", data.challanNo],
    ["Issue Date:", data.issueDate],
    ["Due Date:", data.dueDate],
    ["Student:", data.studentName],
    ["Reg No:", data.admissionNo],
    ["Grade:", data.grade],
  ];

  for (const [label, value] of details) {
    doc.fontSize(7).font("Helvetica").text(label, col, y, { continued: false, width: 65 });
    doc.font("Helvetica-Bold").text(value, col + 65, y - 9, { width: COPY_WIDTH - 65 });
    y += 11;
  }

  y += 4;

  // Fee table header
  doc.moveTo(col, y).lineTo(col + COPY_WIDTH, y).lineWidth(1).stroke();
  y += 3;
  doc.fontSize(7).font("Helvetica-Bold");
  doc.text("Description", col, y, { width: 110 });
  doc.text("Amount", col + 110, y - 9, { width: 70, align: "right" });
  y += 11;
  doc.moveTo(col, y).lineTo(col + COPY_WIDTH, y).lineWidth(1).stroke();
  y += 5;

  // Fee rows
  doc.font("Helvetica").fontSize(7);
  doc.text("Tuition Fee (Monthly)", col, y, { width: 110 });
  doc.font("Helvetica-Bold").text(data.totalAmount, col + 110, y - 9, { width: 70, align: "right" });
  y += 16;

  // Total
  doc.moveTo(col, y).lineTo(col + COPY_WIDTH, y).lineWidth(1).stroke();
  y += 4;
  doc.font("Helvetica-Bold").fontSize(7.5);
  doc.text("TOTAL PAYABLE", col, y, { width: 110 });
  doc.text(data.totalAmount, col + 110, y - 9, { width: 70, align: "right" });
  y += 18;

  // Instructions
  doc.font("Helvetica").fontSize(5.5).fillColor("#475569");
  doc.text("* Payment must be made by the due date.", col, y, { width: COPY_WIDTH });
  y += 7;
  doc.text("* Late fee of 500 PKR applies after due date.", col, y, { width: COPY_WIDTH });
  y += 16;

  // PAID stamp
  if (data.status === "PAID") {
    doc.save();
    doc.rotate(15, { origin: [col + COPY_WIDTH / 2, topY + 200] });
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#15803d").opacity(0.3)
      .text("PAID", col + 40, topY + 190);
    doc.restore();
    doc.fillColor("#000").opacity(1);
  }

  // Signatures
  y = topY + 360;
  doc.fontSize(5.5).font("Helvetica").fillColor("#000");
  doc.moveTo(col, y).lineTo(col + 50, y).lineWidth(0.5).stroke();
  doc.text("Cashier", col, y + 2, { width: 50, align: "center" });
  doc.moveTo(col + COPY_WIDTH - 50, y).lineTo(col + COPY_WIDTH, y).lineWidth(0.5).stroke();
  doc.text("Authorized", col + COPY_WIDTH - 50, y + 2, { width: 50, align: "center" });
}

/**
 * Generate a fee challan PDF (3-copy landscape format).
 * Returns the relative URL path to the generated file.
 */
export async function generateChallanPdf(data: ChallanPdfData): Promise<string> {
  const fileName = `challan-${data.challanNo.replace(/\//g, "-")}-${Date.now()}.pdf`;
  const outDir = path.join(process.cwd(), "public", "generated", "challans");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filePath = path.join(outDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [792, 432],
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    for (let i = 0; i < COPIES.length; i++) {
      const x = PAGE_MARGIN + i * (COPY_WIDTH + GAP);
      drawCopy(doc, data, COPIES[i], x, PAGE_MARGIN);

      if (i < COPIES.length - 1) {
        const divX = x + COPY_WIDTH + GAP / 2;
        doc.save();
        doc.dash(3, { space: 3 });
        doc.moveTo(divX, PAGE_MARGIN).lineTo(divX, 432 - PAGE_MARGIN).lineWidth(0.5).stroke();
        doc.undash();
        doc.restore();
      }
    }

    doc.end();

    stream.on("finish", () => resolve(`/generated/challans/${fileName}`));
    stream.on("error", reject);
  });
}
