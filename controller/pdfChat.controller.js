const fs = require('fs');
const { Document, DocumentChunk, ChatMessage } = require('../models');
const { extractDocument } = require('../services/meetscribe/textExtractor');
const { chunkPages } = require('../services/meetscribe/chunker');
const EmbeddingService = require('../services/meetscribe/embeddingService');
const GeminiService = require('../services/meetscribe/geminiService');
const { saveChunk, searchChunks, deleteChunksForSourceDocument } = require('../services/meetscribe/vectorSearchService');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract, chunk, embed and store a file's vectors.
 *
 * @param {string} fileDocumentId  the `documents` row for the uploaded file
 *                                 (its status/counts are updated here).
 * @param {string} sessionId       the anchor/session id that owns the chunks;
 *                                 vectors are stored under this id so retrieval
 *                                 spans every file merged into the session.
 */
async function ingestDocument(fileDocumentId, sessionId = fileDocumentId) {
  const doc = await Document.findByPk(fileDocumentId);
  if (!doc) return { ok: false, error: 'Document not found' };

  try {
    const { pages, numPages } = await extractDocument(doc.filePath, { mimeType: doc.mimeType });
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new Error('No extractable text found in this file (a scanned/blank image or empty document).');
    }

    // Chunk indices must not collide with chunks already stored for the session
    // (from earlier files), so offset by the current count under the anchor.
    const existing = await DocumentChunk.count({ where: { documentId: sessionId } });

    let stored = 0;
    for (const chunk of chunks) {
      // Embed with a small retry/backoff to ride out transient rate limits.
      let embedding;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          embedding = await EmbeddingService.generateDocumentEmbedding(chunk.content);
          break;
        } catch (err) {
          const quota = /\b429\b|quota|rate.?limit|resource_exhausted/i.test(err.message || '');
          if (attempt === 3 || !quota) throw err;
          const waitMs = 2000 * (attempt + 1);
          console.warn(`[meetscribe] embed rate-limited, retrying in ${waitMs}ms (chunk ${chunk.chunkIndex})`);
          await sleep(waitMs);
        }
      }

      await saveChunk({
        // Vectors live under the session anchor so RAG retrieval spans all files.
        documentId: sessionId,
        chunkIndex: existing + chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        embedding,
        // Track which physical file each chunk came from for later cleanup.
        metadata: { page: chunk.pageNumber, sourceDocumentId: fileDocumentId, sourceFileName: doc.fileName },
      });
      stored += 1;
    }

    doc.status = 'READY';
    doc.pageCount = numPages;
    doc.chunkCount = stored;
    doc.error = null;
    await doc.save();
    console.log(`[meetscribe] ingested "${doc.fileName}" — ${numPages} pages, ${stored} chunks (session ${sessionId})`);
    return { ok: true, document: doc };
  } catch (err) {
    console.error('[meetscribe] ingestion failed:', err.message);
    doc.status = 'FAILED';
    doc.error = err.message;
    await doc.save().catch(() => {});
    return { ok: false, document: doc, error: err.message };
  }
}

class PdfChatController {
  // POST /user/pdf/upload  (multipart: field "pdf")
  static async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }
      if (!EmbeddingService.isConfigured()) {
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(503).json({
          success: false,
          error: { code: 'GEMINI_KEY_MISSING', message: 'MeetScribe AI is unavailable: GEMINI_API_KEY is not configured on the server.' }
        });
      }

      // Multi-document sessions: an `activeDocumentId` in the body means this
      // file should be MERGED into an existing chat session rather than
      // starting a new one. Resolve it to the session anchor first.
      const { activeDocumentId } = req.body;
      let sessionAnchorId = null;

      if (activeDocumentId) {
        const anchor = await Document.findOne({
          where: { id: activeDocumentId, userId: req.user.id },
        });
        if (!anchor) {
          fs.promises.unlink(req.file.path).catch(() => {});
          return res.status(404).json({
            success: false,
            error: { code: 'SESSION_NOT_FOUND', message: 'Active chat session not found.' },
          });
        }
        // The anchor is either its own session, or points at one via sessionId.
        sessionAnchorId = anchor.sessionId || anchor.id;
      }

      const doc = await Document.create({
        userId: req.user.id,
        // A brand-new upload anchors its own session; a merged file points at
        // the existing anchor. (Own-anchor rows get sessionId backfilled below.)
        sessionId: sessionAnchorId,
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        status: 'PROCESSING',
      });

      // New session: the document is its own anchor.
      if (!sessionAnchorId) {
        doc.sessionId = doc.id;
        await doc.save();
      }

      const targetSessionId = sessionAnchorId || doc.id;
      ingestDocument(doc.id, targetSessionId);

      return res.status(201).json({
        success: true,
        data: { document: doc, sessionId: targetSessionId },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/pdf — list the user's documents.
  static async list(req, res, next) {
    try {
      const documents = await Document.findAll({
        where: {
          userId: req.user.id,
          isChatAttachment: false,
        },
        order: [['createdAt', 'DESC']],
      });
      return res.status(200).json({ success: true, data: { documents } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /user/pdf/:documentId — remove document, chunks, messages, and file.
  static async remove(req, res, next) {
    try {
      const doc = await Document.findOne({ where: { id: req.params.documentId, userId: req.user.id } });
      if (!doc) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }
      const filePath = doc.filePath;
      const sessionId = doc.sessionId || doc.id;

      // Supplementary vectors are stored under the session anchor rather than
      // under the supplementary document row. Remove them explicitly before
      // deleting the file row, otherwise deleted content would remain in RAG.
      if (sessionId !== doc.id) {
        await deleteChunksForSourceDocument({
          sessionId,
          sourceDocumentId: doc.id,
        });
      }

      await doc.destroy();
      fs.promises.unlink(filePath).catch(() => {});
      return res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/pdf/:documentId/messages — chat history for a document.
  static async messages(req, res, next) {
    try {
      const doc = await Document.findOne({ where: { id: req.params.documentId, userId: req.user.id } });
      if (!doc) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }
      // History lives under the session anchor, so it persists across every
      // file merged into the session.
      const sessionId = doc.sessionId || doc.id;
      const messages = await ChatMessage.findAll({
        where: { documentId: sessionId, userId: req.user.id },
        order: [['createdAt', 'ASC']],
      });
      return res.status(200).json({ success: true, data: { messages } });
    } catch (error) {
      next(error);
    }
  }

  // POST /user/pdf/:documentId/chat  { question } — the RAG answer step.
  static async chat(req, res, next) {
    try {
      const { question } = req.body;
      if (!question || !question.trim()) {
        return res.status(400).json({ success: false, error: { code: 'NO_QUESTION', message: 'A question is required' } });
      }

      const doc = await Document.findOne({ where: { id: req.params.documentId, userId: req.user.id } });
      if (!doc) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }

      // Everything in a chat session is keyed to the session anchor id so RAG
      // retrieval and history span every file merged into the session.
      const sessionId = doc.sessionId || doc.id;

      if (!EmbeddingService.isConfigured()) {
        return res.status(503).json({ success: false, error: { code: 'GEMINI_KEY_MISSING', message: 'MeetScribe AI is unavailable: GEMINI_API_KEY is not configured.' } });
      }

      // Files staged in the active composer are uploaded as part of the chat
      // submission. Process them synchronously so the current question can
      // retrieve their vectors immediately, not only on the next question.
      const incomingFiles = Array.isArray(req.files) ? req.files : [];
      const messageAttachments = [];

      for (const file of incomingFiles) {
        const uploadedDocument = await Document.create({
          userId: req.user.id,
          sessionId,
          isChatAttachment: true,
          fileName: file.originalname,
          filePath: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: 'PROCESSING',
        });

        const ingestion = await ingestDocument(uploadedDocument.id, sessionId);
        if (!ingestion.ok) {
          await deleteChunksForSourceDocument({
            sessionId,
            sourceDocumentId: uploadedDocument.id,
          }).catch(() => {});
          await uploadedDocument.destroy().catch(() => {});
          fs.promises.unlink(file.path).catch(() => {});
          return res.status(422).json({
            success: false,
            error: { code: 'ATTACHMENT_PROCESSING_FAILED', message: 'One or more attachments could not be processed.' },
          });
        }

        messageAttachments.push({
          documentId: uploadedDocument.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      }

      // Ready when the session has at least one embedded chunk (including any
      // files just submitted with this message).
      const readyChunks = await DocumentChunk.count({ where: { documentId: sessionId } });
      if (readyChunks === 0) {
        return res.status(409).json({ success: false, error: { code: 'NOT_READY', message: 'This document is still being processed.' } });
      }
      if (!EmbeddingService.isConfigured()) {
        return res.status(503).json({ success: false, error: { code: 'GEMINI_KEY_MISSING', message: 'MeetScribe AI is unavailable: GEMINI_API_KEY is not configured.' } });
      }
      // local chat_messages table (scoped to userId + sessionId). This is the
      // context we replay on recovery instead of relying on API memory.
      const priorHistory = await ChatMessage.findAll({
        where: { documentId: sessionId, userId: req.user.id },
        order: [['createdAt', 'ASC']],
        attributes: ['role', 'message'],
      });
      const history = priorHistory.map((m) => ({ role: m.role, message: m.message }));

      // Persist the user's message under the session anchor.
      await ChatMessage.create({
        userId: req.user.id,
        documentId: sessionId,
        role: 'user',
        message: question.trim(),
        attachments: messageAttachments.length ? messageAttachments : null,
      });

      // Embed the question, retrieve top chunks across ALL files in the session
      // (filtered strictly by the session id) from the local document_chunks table.
      const queryEmbedding = await EmbeddingService.generateQueryEmbedding(question.trim());
      const chunks = await searchChunks({ userId: req.user.id, documentId: sessionId, queryEmbedding, limit: 5 });

      let answer;
      try {
        // Send the reconstructed payload: current question + full prior history
        // + retrieved local embeddings/chunks. On a Gemini 503 UNAVAILABLE the
        // service rebuilds this same local context and re-transmits internally.
        answer = await GeminiService.answerQuestion(question.trim(), chunks, history);
      } catch (genErr) {
        // Rule 1 — Frontend error masking. Never surface raw API errors, JSON
        // error bodies, or 503 status codes. Return exactly the safe string.
        console.error('[meetscribe] chat generation failed after recovery attempts:', genErr.message);
        return res.status(200).json({
          success: false,
          error: { code: 'AI_UNAVAILABLE', message: 'Something went wrong, please try again' },
        });
      }

      const sources = chunks.map((c) => ({
        page: c.page_number,
        fileName: c.source_file_name || null,
        similarity: Number(c.similarity),
      }));

      // Persist the assistant's answer + its sources under the session anchor.
      const saved = await ChatMessage.create({
        userId: req.user.id,
        documentId: sessionId,
        role: 'assistant',
        message: answer,
        sources,
      });

      return res.status(200).json({
        success: true,
        data: {
          answer,
          sources,
          messageId: saved.id,
          attachments: messageAttachments,
        },
      });
    } catch (error) {
      // Rule 1 — Any unexpected failure in the chat path is also masked so raw
      // errors never reach the frontend.
      console.error('[meetscribe] chat handler error:', error.message);
      return res.status(200).json({
        success: false,
        error: { code: 'AI_UNAVAILABLE', message: 'Something went wrong, please try again' },
      });
    }
  }
}

module.exports = PdfChatController;
