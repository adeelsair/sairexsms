/**
 * Verify that an uploaded NTN certificate (PDF) contains the given NTN number
 * and organization name. Used in onboarding legal step.
 *
 * Uses two methods in order:
 * 1. Text extraction – unpdf (serverless PDF.js, no worker file) for digital PDFs.
 * 2. OCR fallback – when text is missing/short (e.g. scanned PDF), render first page
 *    and run Tesseract.js (only if rendering is available).
 */

/** Set to true to require the certificate PDF to contain the organization name. */
const VERIFY_ORGANIZATION_NAME = false;

/** Minimum extracted text length to consider "has text layer". Below this we try OCR. */
const MIN_TEXT_LENGTH_FOR_DECODE = 15;

const DATA_URL_PDF_PREFIXES = [
  "data:application/pdf;base64,",
  "data:application/octet-stream;base64,",
  "data:application/x-pdf;base64,",
];

function decodeDataUrlToBuffer(dataUrl: string): Buffer | null {
  const trimmed = dataUrl.trim();
  const prefix = DATA_URL_PDF_PREFIXES.find((p) => trimmed.startsWith(p));
  if (!prefix) {
    return null;
  }
  try {
    const base64 = trimmed.slice(prefix.length).replace(/\s/g, "");
    const buffer = Buffer.from(base64, "base64");
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/** Normalize NTN for matching: digits only (e.g. "1234567-8" -> "12345678") */
export function normalizeNtnForMatch(ntn: string): string {
  return ntn.replace(/\D/g, "");
}

/** Normalize org name for matching: lowercase, trim, collapse spaces */
export function normalizeOrgNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Check if documentDigitsOnly contains a sequence of length ntnDigits
 * with at most maxErrors character differences (for OCR misreads like 0/O, 1/l).
 */
function findNtnWithTolerance(
  documentDigitsOnly: string,
  ntnDigits: string,
  maxErrors: number,
): boolean {
  const len = ntnDigits.length;
  if (documentDigitsOnly.length < len) return false;
  for (let i = 0; i <= documentDigitsOnly.length - len; i++) {
    const slice = documentDigitsOnly.slice(i, i + len);
    let errors = 0;
    for (let j = 0; j < len; j++) {
      if (slice[j] !== ntnDigits[j]) errors++;
      if (errors > maxErrors) break;
    }
    if (errors <= maxErrors) return true;
  }
  return false;
}

/**
 * Run Tesseract OCR on an image buffer (e.g. PNG from PDF screenshot).
 */
async function runOcrOnImageBuffer(imageBuffer: Uint8Array): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, { logger: () => {} });
  try {
    const ret = await worker.recognize(Buffer.from(imageBuffer));
    const text = (ret as { data?: { text?: string } }).data?.text;
    return text ?? "";
  } finally {
    await worker.terminate();
  }
}

/**
 * Try to render the first PDF page to an image for OCR. Uses pdf-parse getScreenshot.
 * May fail in some environments (e.g. worker path); returns null then.
 */
async function renderFirstPageToImage(buffer: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const screenshot = await parser.getScreenshot({
      first: 1,
      imageBuffer: true,
      imageDataUrl: false,
    });
    await parser.destroy();
    if (screenshot.pages.length > 0 && screenshot.pages[0].data) {
      return screenshot.pages[0].data;
    }
  } catch (err) {
    console.error("NTN certificate render to image error:", err);
  }
  return null;
}

export interface VerifyNtnCertResult {
  ok: boolean;
  error?: "not_pdf" | "parse_failed" | "ntn_mismatch" | "org_name_mismatch";
  message?: string;
}

/**
 * Extract text from the PDF and check that it contains the given NTN (digits)
 * and optionally organization name. Uses unpdf first (no worker), then OCR if needed.
 */
export async function verifyNtnCertificate(
  certificateDataUrl: string,
  taxNumber: string,
  organizationName: string,
): Promise<VerifyNtnCertResult> {
  const buffer = decodeDataUrlToBuffer(certificateDataUrl);
  if (!buffer || buffer.length === 0) {
    return {
      ok: false,
      error: "not_pdf",
      message: "NTN certificate must be a PDF file.",
    };
  }

  if (buffer.length < 100) {
    return {
      ok: false,
      error: "parse_failed",
      message:
        "Certificate file may be incomplete or corrupted. Try uploading again or use a smaller PDF.",
    };
  }

  const ntnDigits = normalizeNtnForMatch(taxNumber);
  const orgName = normalizeOrgNameForMatch(organizationName);
  if (!ntnDigits) {
    return {
      ok: false,
      error: "ntn_mismatch",
      message: "NTN number is required.",
    };
  }

  let text = "";

  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const extracted: unknown = result.text;
    if (typeof extracted === "string") {
      text = extracted;
    } else if (Array.isArray(extracted)) {
      text = extracted.map((part) => String(part)).join(" ");
    } else {
      text = "";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("NTN certificate unpdf extract error:", message, err);
    if (/password|encrypted|security/i.test(message)) {
      return {
        ok: false,
        error: "parse_failed",
        message: "This PDF is password-protected. Please upload an unprotected copy.",
      };
    }
    text = "";
  }

  const tryOcr = text.length < MIN_TEXT_LENGTH_FOR_DECODE;

  if (tryOcr) {
    const imageData = await renderFirstPageToImage(new Uint8Array(buffer));
    if (imageData) {
      try {
        text = await runOcrOnImageBuffer(imageData);
      } catch (ocrErr) {
        console.error("NTN certificate OCR error:", ocrErr);
      }
    }
  }

  if (!text || text.trim().length < 3) {
    return {
      ok: false,
      error: "parse_failed",
      message:
        "Could not read text from this PDF. Use a PDF with selectable text, or a clear scan.",
    };
  }

  const normalizedText = text.replace(/\s+/g, " ");
  const documentDigitsOnly = text.replace(/\D/g, "");
  const exactMatch = normalizedText.includes(ntnDigits);
  const digitsOnlyMatch = documentDigitsOnly.includes(ntnDigits);
  const usedOcr = tryOcr && text.trim().length >= 3;
  // Only allow 1-digit tolerance for OCR'd text (scans); digital PDFs must match exactly
  const relaxedMatch =
    usedOcr &&
    ntnDigits.length >= 6 &&
    findNtnWithTolerance(documentDigitsOnly, ntnDigits, 1);

  if (!exactMatch && !digitsOnlyMatch && !relaxedMatch) {
    return {
      ok: false,
      error: "ntn_mismatch",
      message:
        "The certificate does not contain the NTN number you entered. Please upload the correct NTN certificate.",
    };
  }

  if (VERIFY_ORGANIZATION_NAME) {
    if (!orgName) {
      return {
        ok: false,
        error: "org_name_mismatch",
        message: "Organization name is required.",
      };
    }

    const orgTokens = orgName.split(/\s+/).filter((t) => t.length >= 2);
    const textLower = normalizedText.toLowerCase();
    const hasOrgMatch =
      orgTokens.length === 0 ||
      orgTokens.some((token) => textLower.includes(token)) ||
      textLower.includes(orgName);

    if (!hasOrgMatch) {
      return {
        ok: false,
        error: "org_name_mismatch",
        message:
          "The certificate does not contain the organization name you entered. Please upload the correct NTN certificate.",
      };
    }
  }

  return { ok: true };
}
