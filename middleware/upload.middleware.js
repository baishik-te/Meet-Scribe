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
    const ext = (file.originalname && path.extname(file.originalname)) || '.pdf';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed'));
  }
});

module.exports = { uploadRecording, uploadPdf, UPLOADS_DIR, RECORDINGS_DIR, PDFS_DIR };
