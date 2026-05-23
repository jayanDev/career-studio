/**
 * Real PDF / DOCX / plain-text extraction for the ATS pipeline.
 *
 * Returns both the flat text (what the scorer consumes) and a `raw` payload
 * that downstream features (parsing simulator, formatting-hazard detector)
 * use to inspect what the ATS actually "sees".
 *
 * PDF parsing uses `unpdf` because it runs in Next.js server components and
 * edge runtimes without bundling the entire pdfjs worker.
 * DOCX parsing uses `mammoth` for text + raw XML (so we can detect tables).
 */

export type ExtractedResume = {
  text: string;
  wordCount: number;
  source: "pdf" | "docx" | "doc" | "txt" | "buffer";
  pageCount?: number;
  /** Per-page text — used by the parsing simulator and column detection. */
  pages?: string[];
  /** True if the file contains embedded images. ATS parsers strip these. */
  hasImages?: boolean;
  /** True if the document contains <w:tbl> tables (DOCX) or column gaps (PDF). */
  hasTables?: boolean;
  /** True if header/footer content was detected. ATS often ignores these. */
  hasHeaderFooter?: boolean;
  /** Warnings raised during extraction (e.g. fallback used). */
  warnings: string[];
};

const PRINTABLE = /[^\x09\x0a\x0d\x20-\x7E]+/g;

function clean(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function wordCountOf(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function extractPdf(buffer: Buffer): Promise<ExtractedResume> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  // Column detection heuristic: a page has columns if many lines contain
  // a large internal whitespace gap (>= 6 spaces) consistently.
  let columnLines = 0;
  let totalLines = 0;
  for (const page of pages) {
    for (const line of page.split("\n")) {
      if (!line.trim()) continue;
      totalLines += 1;
      if (/ {6,}/.test(line)) columnLines += 1;
    }
  }
  const hasTables = totalLines > 0 && columnLines / totalLines > 0.25;

  // Image detection: read the PDF dictionary for image XObjects.
  let hasImages = false;
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const ops = await page.getOperatorList();
      // 85 = OPS.paintImageXObject in pdfjs
      if (ops.fnArray.includes(85)) {
        hasImages = true;
        break;
      }
    }
  } catch {
    // Best-effort; not fatal.
  }

  const joined = clean(pages.join("\n\n"));
  return {
    text: joined,
    wordCount: wordCountOf(joined),
    source: "pdf",
    pageCount: totalPages,
    pages: pages.map(clean),
    hasImages,
    hasTables,
    warnings: [],
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedResume> {
  const mammoth = await import("mammoth");
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);
  const text = clean(textResult.value);
  const html = htmlResult.value;

  return {
    text,
    wordCount: wordCountOf(text),
    source: "docx",
    pageCount: undefined,
    hasImages: /<img\b/i.test(html),
    hasTables: /<table\b/i.test(html),
    hasHeaderFooter: false, // mammoth ignores headers/footers by default
    warnings: [
      ...textResult.messages.map((m) => `docx: ${m.message}`),
      ...htmlResult.messages.map((m) => `docx: ${m.message}`),
    ].slice(0, 5),
  };
}

function extractPlainText(buffer: Buffer, source: ExtractedResume["source"]): ExtractedResume {
  const text = clean(buffer.toString("utf8").replace(PRINTABLE, " ").replace(/\s+/g, " "));
  return {
    text,
    wordCount: wordCountOf(text),
    source,
    warnings: [],
  };
}

/**
 * Dispatch on detected MIME / extension. Falls back to the lossy buffer
 * strategy only as a last resort and records a warning.
 */
export async function extractResume(
  buffer: Buffer,
  hints: { mime?: string; filename?: string } = {},
): Promise<ExtractedResume> {
  const mime = (hints.mime ?? "").toLowerCase();
  const ext = (hints.filename ?? "").toLowerCase().split(".").pop() ?? "";

  try {
    if (mime.includes("pdf") || ext === "pdf") return await extractPdf(buffer);
    if (
      mime.includes("officedocument.wordprocessingml") ||
      mime.includes("msword") ||
      ext === "docx"
    ) {
      return await extractDocx(buffer);
    }
    if (mime.startsWith("text/") || ext === "txt") {
      return extractPlainText(buffer, "txt");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = extractPlainText(buffer, "buffer");
    fallback.warnings.push(`Structured extraction failed (${message}); used lossy fallback.`);
    return fallback;
  }

  const fallback = extractPlainText(buffer, "buffer");
  fallback.warnings.push("Unknown file type; used lossy plain-text fallback.");
  return fallback;
}

/**
 * Pure-text entry point for `resumeText` pasted directly into the form.
 */
export function extractFromPastedText(raw: string): ExtractedResume {
  const text = clean(raw);
  return {
    text,
    wordCount: wordCountOf(text),
    source: "txt",
    warnings: [],
  };
}
