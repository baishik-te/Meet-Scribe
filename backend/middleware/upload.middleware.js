const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const RECORDINGS_DIR = path.join(UPLOADS_DIR, 'recordings');
const PDFS_DIR = path.join(UPLOADS_DIR, 'pdfs');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(PDFS_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });

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

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.png';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const ALLOWED_AVATAR_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB cap
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      return cb(null, true);
    }
    const err = new Error('Unsupported file type. Allowed: PNG, JPG, WEBP.');
    err.status = 400;
    err.code = 'UNSUPPORTED_FILE_TYPE';
    cb(err);
  }
});

const MESSAGE_FILES_DIR = path.join(UPLOADS_DIR, 'messages', 'files');
fs.mkdirSync(MESSAGE_FILES_DIR, { recursive: true });

const messageFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MESSAGE_FILES_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '';
    const safeBase = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}-${safeBase}${ext}`);
  }
});

const uploadMessageFile = multer({
  storage: messageFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB cap
});

// `uploadPdf` kept as an alias for backward compatibility with existing routes.
module.exports = {
  uploadRecording,
  uploadDocument,
  uploadPdf: uploadDocument,
  uploadAvatar,
  uploadMessageFile,
  UPLOADS_DIR,
  RECORDINGS_DIR,
  PDFS_DIR,
  AVATARS_DIR,
  MESSAGE_FILES_DIR,
};
