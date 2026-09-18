const router = require('express').Router();
const PdfChatController = require('../controller/pdfChat.controller');
const { uploadPdf } = require('../middleware/upload.middleware');

// MeetScribe AI — RAG PDF chat. Mounted under /user/pdf, so it inherits the
// authenticate + verifyActive middleware from user.routes.
router.post('/upload', uploadPdf.single('pdf'), PdfChatController.upload);
router.get('/', PdfChatController.list);
router.delete('/:documentId', PdfChatController.remove);
router.get('/:documentId/messages', PdfChatController.messages);
router.post('/:documentId/chat', PdfChatController.chat);

module.exports = router;
