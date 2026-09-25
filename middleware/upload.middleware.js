const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const RECORDINGS_DIR = path.join(UPLOADS_DIR, 'recordings');
const PDFS_DIR = path.join(UPLOADS_DIR, 'pdfs');

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(PDFS_DIR, { recursive: true });

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RECORDINGS_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.webm';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB cap
});

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDFS_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.dat';
    cb(null, `${uuidv4()}${ext}`);
  }
});

// Accept PDF, plain text, Word (.docx), Excel (.xlsx), and images (png/jpg/jpeg).
const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);
const ALLOWED_DOC_EXT = /\.(pdf|txt|docx|xlsx|png|jpe?g)$/i;

const uploadDocument = multer({
  storage: pdfStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOC_MIME.has(file.mimetype) || ALLOWED_DOC_EXT.test(file.originalname || '')) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type. Allowed: PDF, TXT, DOCX, XLSX, PNG, JPG, JPEG.'));
  }
});

// `uploadPdf` kept as an alias for backward compatibility with existing routes.
module.exports = {
  uploadRecording,
  uploadDocument,
  uploadPdf: uploadDocument,
  UPLOADS_DIR,
  RECORDINGS_DIR,
  PDFS_DIR,
};
