const fs = require('fs');
const path = require('path');
const { extractPdfPages } = require('./pdfExtractor');

// Supported upload types, keyed by lowercase extension. MIME types are checked
// too (see isSupportedUpload) because browsers don't always send a reliable
// extension for images/office docs.
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function extOf(filePath) {
  return path.extname(filePath || '').toLowerCase();
}

/** True if a multer file (originalname + mimetype) is an accepted upload. */
function isSupportedUpload(originalName, mimeType) {
  const ext = extOf(originalName);
  if (SUPPORTED_EXTENSIONS.includes(ext)) return true;
  if (mimeType && SUPPORTED_MIME_TYPES.has(mimeType)) return true;
  return false;
}

// --- Per-format extractors. Each returns pages: [{ page, text }]. ---------

async function extractTxt(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const text = raw.trim();
  return { pages: text ? [{ page: 1, text }] : [], numPages: 1 };
}

async function extractDocx(filePath) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ path: filePath });
  const text = (value || '').trim();
  return { pages: text ? [{ page: 1, text }] : [], numPages: 1 };
}

async function extractXlsx(filePath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);

  // One "page" per sheet so answers can reference which sheet a value came from.
  const pages = [];
  let pageNo = 0;
  for (const sheetName of workbook.SheetNames) {
    pageNo += 1;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    // CSV keeps rows/columns readable as plain text for embedding.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) continue;
    const text = `Sheet: ${sheetName}\n${csv}`;
    pages.push({ page: pageNo, text });
  }

  return { pages, numPages: workbook.SheetNames.length || pages.length };
}

async function extractImage(filePath) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(filePath);
    const text = (data.text || '').trim();
    return { pages: text ? [{ page: 1, text }] : [], numPages: 1 };
  } finally {
    await worker.terminate().catch(() => {});
  }
}

/**
 * Extract text from any supported document type, returning the same shape the
 * chunker consumes: { pages: [{ page, text }], numPages }.
 *
 * Dispatch is by file extension (with a small MIME fallback for images).
 */
async function extractDocument(filePath, { mimeType } = {}) {
  const ext = extOf(filePath);

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return extractPdfPages(filePath);
  }
  if (ext === '.txt' || mimeType === 'text/plain') {
    return extractTxt(filePath);
  }
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocx(filePath);
  }
  if (ext === '.xlsx' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return extractXlsx(filePath);
  }
  if (IMAGE_EXTENSIONS.has(ext) || (mimeType && mimeType.startsWith('image/'))) {
    return extractImage(filePath);
  }

  throw new Error(`Unsupported file type: ${ext || mimeType || 'unknown'}`);
}

module.exports = {
  extractDocument,
  isSupportedUpload,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
};
