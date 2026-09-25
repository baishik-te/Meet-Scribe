const router = require('express').Router();
const PdfChatController = require('../controller/pdfChat.controller');
const { uploadPdf, uploadDocument } = require('../middleware/upload.middleware');


router.post('/upload', uploadPdf.single('pdf'), PdfChatController.upload);
router.get('/', PdfChatController.list);
router.delete('/:documentId', PdfChatController.remove);
router.get('/:documentId/messages', PdfChatController.messages);
router.post('/:documentId/chat', uploadDocument.array('attachments', 5), PdfChatController.chat);

module.exports = router;
