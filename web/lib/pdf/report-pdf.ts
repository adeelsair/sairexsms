import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface ReportRow {
  [key: string]: string | number;
}

export interface ReportPdfData {
  title: string;
  subtitle?: string;
  organizationName: string;
  generatedBy: string;
  columns: { key: string; label: string; width: number; align?: "left" | "right" | "center" }[];
  rows: ReportRow[];
  summary?: { label: string; value: string }[];
}

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 16;

/**
 * Generate a tabular report PDF.
 * Returns the relative URL path to the generated file.
 */
export async function generateReportPdf(data: ReportPdfData): Promise<string> {
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fileName = `report-${slug}-${Date.now()}.pdf`;
  const outDir = path.join(process.cwd(), "public", "generated", "reports");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filePath = path.join(outDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const pageWidth = 595 - PAGE_MARGIN * 2;
    let y = PAGE_MARGIN;

    // Header
    doc.fontSize(14).font("Helvetica-Bold").text(data.organizationName.toUpperCase(), PAGE_MARGIN, y, {
      width: pageWidth, align: "center",
    });
    y += 20;

    doc.fontSize(12).font("Helvetica-Bold").text(data.title, PAGE_MARGIN, y, {
      width: pageWidth, align: "center",
    });
    y += 16;

    if (data.subtitle) {
      doc.fontSize(8).font("Helvetica").text(data.subtitle, PAGE_MARGIN, y, {
        width: pageWidth, align: "center",
      });
      y += 12;
    }

    doc.fontSize(7).font("Helvetica").fillColor("#64748b")
      .text(`Generated: ${new Date().toLocaleString()} | By: ${data.generatedBy}`, PAGE_MARGIN, y, {
        width: pageWidth, align: "center",
      });
    y += 20;
    doc.fillColor("#000");

    // Table header
    doc.rect(PAGE_MARGIN, y, pageWidth, ROW_HEIGHT).fill("#e2e8f0");
    doc.fillColor("#000");

    let colX = PAGE_MARGIN + 4;
    for (const col of data.columns) {
      doc.fontSize(7).font("Helvetica-Bold")
        .text(col.label, colX, y + 4, { width: col.width, align: col.align || "left" });
      colX += col.width;
    }
    y += ROW_HEIGHT;

    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).lineWidth(0.5).stroke();

    // Rows
    for (let i = 0; i < data.rows.length; i++) {
      if (y > 800 - PAGE_MARGIN - ROW_HEIGHT * 2) {
        doc.addPage();
        y = PAGE_MARGIN;
      }

      const row = data.rows[i];

      if (i % 2 === 1) {
        doc.rect(PAGE_MARGIN, y, pageWidth, ROW_HEIGHT).fill("#f8fafc");
        doc.fillColor("#000");
      }

      colX = PAGE_MARGIN + 4;
      for (const col of data.columns) {
        doc.fontSize(6.5).font("Helvetica")
          .text(String(row[col.key] ?? ""), colX, y + 4, { width: col.width, align: col.align || "left" });
        colX += col.width;
      }
      y += ROW_HEIGHT;
    }

    // Summary
    if (data.summary && data.summary.length > 0) {
      y += 10;
      doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).lineWidth(1).stroke();
      y += 6;

      for (const item of data.summary) {
        doc.fontSize(8).font("Helvetica-Bold")
          .text(item.label, PAGE_MARGIN + pageWidth - 200, y, { width: 120, align: "right" });
        doc.text(item.value, PAGE_MARGIN + pageWidth - 80, y - 10, { width: 80, align: "right" });
        y += 14;
      }
    }

    doc.end();

    stream.on("finish", () => resolve(`/generated/reports/${fileName}`));
    stream.on("error", reject);
  });
}
