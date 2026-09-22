const fs = require('fs');
const { Document, DocumentChunk, ChatMessage } = require('../models');
const { extractPdfPages } = require('../services/meetscribe/pdfExtractor');
const { chunkPages } = require('../services/meetscribe/chunker');
const EmbeddingService = require('../services/meetscribe/embeddingService');
const GeminiService = require('../services/meetscribe/geminiService');
const { saveChunk, searchChunks } = require('../services/meetscribe/vectorSearchService');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ingestDocument(documentId) {
  const doc = await Document.findByPk(documentId);
  if (!doc) return;

  try {
    const { pages, numPages } = await extractPdfPages(doc.filePath);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new Error('No extractable text found in this PDF (it may be scanned images).');
    }

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
        documentId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        embedding,
        metadata: { page: chunk.pageNumber },
      });
      stored += 1;
    }

    doc.status = 'READY';
    doc.pageCount = numPages;
    doc.chunkCount = stored;
    doc.error = null;
    await doc.save();
    console.log(`[meetscribe] ingested "${doc.fileName}" — ${numPages} pages, ${stored} chunks`);
  } catch (err) {
    console.error('[meetscribe] ingestion failed:', err.message);
    doc.status = 'FAILED';
    doc.error = err.message;
    await doc.save().catch(() => {});
  }
}

class PdfChatController {
  // POST /user/pdf/upload  (multipart: field "pdf")
  static async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No PDF uploaded' } });
      }
      if (!EmbeddingService.isConfigured()) {
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(503).json({
          success: false,
          error: { code: 'GEMINI_KEY_MISSING', message: 'MeetScribe AI is unavailable: GEMINI_API_KEY is not configured on the server.' }
        });
      }

      const doc = await Document.create({
        userId: req.user.id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        status: 'PROCESSING',
      });
      ingestDocument(doc.id);

      return res.status(201).json({ success: true, data: { document: doc } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/pdf — list the user's documents.
  static async list(req, res, next) {
    try {
      const documents = await Document.findAll({
        where: { userId: req.user.id },
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
      const messages = await ChatMessage.findAll({
        where: { documentId: doc.id, userId: req.user.id },
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
      if (doc.status !== 'READY') {
        return res.status(409).json({ success: false, error: { code: 'NOT_READY', message: 'This document is still being processed.' } });
      }
      if (!EmbeddingService.isConfigured()) {
        return res.status(503).json({ success: false, error: { code: 'GEMINI_KEY_MISSING', message: 'MeetScribe AI is unavailable: GEMINI_API_KEY is not configured.' } });
      }

      // Persist the user's message.
      await ChatMessage.create({ userId: req.user.id, documentId: doc.id, role: 'user', message: question.trim() });

      // Embed the question, retrieve top chunks (scoped to this user + doc).
      const queryEmbedding = await EmbeddingService.generateQueryEmbedding(question.trim());
      const chunks = await searchChunks({ userId: req.user.id, documentId: doc.id, queryEmbedding, limit: 5 });

      const answer = await GeminiService.answerQuestion(question.trim(), chunks);
      const sources = chunks.map((c) => ({ page: c.page_number, similarity: Number(c.similarity) }));

      // Persist the assistant's answer + its sources.
      const saved = await ChatMessage.create({
        userId: req.user.id,
        documentId: doc.id,
        role: 'assistant',
        message: answer,
        sources,
      });

      return res.status(200).json({ success: true, data: { answer, sources, messageId: saved.id } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PdfChatController;
