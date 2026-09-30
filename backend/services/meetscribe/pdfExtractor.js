const fs = require('fs');

/**
 * Extract text from a PDF, preserving page numbers so answers can cite pages.
 * Returns { pages: [{ page, text }], numPages }.
 *
 * Uses pdf-parse v2's class API (`new PDFParse({ data }).getText()`), which
 * returns page-wise text: { pages: [{ num, text }], text, total }.
 */
async function extractPdfPages(pdfPath) {
  const { PDFParse } = require('pdf-parse');
  const buffer = fs.readFileSync(pdfPath);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();

    const pages = (result.pages || [])
      .map((p) => ({ page: p.num, text: (p.text || '').trim() }))
      .filter((p) => p.text.length > 0);

    // Fallback: if per-page came back empty but there is concatenated text.
    if (pages.length === 0 && result.text && result.text.trim()) {
      pages.push({ page: 1, text: result.text.trim() });
    }

    return { pages, numPages: result.total || pages.length };
  } finally {
    // Release the underlying pdf.js document/resources.
    await parser.destroy().catch(() => {});
  }
}

module.exports = { extractPdfPages };
