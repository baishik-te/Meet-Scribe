const { getAI, isConfigured, GENERATION_MODEL } = require('./genaiClient');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Detect the Gemini "session timeout" style outage: HTTP 503 / UNAVAILABLE.
function isUnavailableError(err) {
  if (!err) return false;
  const status = err.status ?? err.code ?? err.response?.status;
  if (status === 503) return true;
  const msg = `${err.message || ''} ${err.status || ''} ${err.code || ''}`;
  return /\b503\b|unavailable|session.?time?d?.?out|overloaded/i.test(msg);
}

// Build the grounding context block from retrieved local document chunks.
function buildContextText(contexts) {
  return (contexts || [])
    .map((c) => `[Page ${c.page_number ?? '?'}]\n${c.content}`)
    .join('\n\n');
}

// Render prior chat turns (already retrieved locally from chat_messages,
// scoped to this user + this document) into a transcript for the model.
function buildHistoryText(history) {
  if (!history || history.length === 0) return '';
  return history
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.message}`)
    .join('\n');
}

// Assemble the full reconstructed prompt: system instructions + local
// document context + full previous chat history + the current question.
function buildPrompt(question, contexts, history) {
  const contextText = buildContextText(contexts);
  const historyText = buildHistoryText(history);

  return (
    'You are MeetScribe AI, an assistant that answers questions about an uploaded PDF.\n' +
    "Answer using ONLY the provided context. If the answer isn't in the context, say you " +
    "couldn't find it in the document. Where helpful, cite page numbers like \"(page 4)\".\n\n" +
    (historyText ? `Previous conversation:\n${historyText}\n\n` : '') +
    `Context:\n${contextText}\n\n` +
    `Question: ${question}\n\nAnswer:`
  );
}

async function generateOnce(prompt) {
  const res = await getAI().models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
  });
  return (res.text || '').trim();
}

/**
 * RAG generation step: answer a question using the retrieved local chunks and
 * the full previous chat history.
 *
 * On a Gemini 503 UNAVAILABLE (session timeout / overloaded), we do NOT rely on
 * any server-side/API session memory. Instead we reconstruct a fresh, complete
 * payload from local data — the current question, the full prior chat history
 * (from chat_messages) and the retrieved document embeddings/chunks (from
 * document_chunks) — and re-transmit it, retrying with backoff.
 *
 * @param {string} question
 * @param {Array<{ page_number: number|null, content: string }>} contexts local chunks
 * @param {Array<{ role: 'user'|'assistant', message: string }>} [history] prior turns
 * @returns {Promise<string>}
 */
async function answerQuestion(question, contexts, history = []) {
  const prompt = buildPrompt(question, contexts, history);

  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateOnce(prompt);
    } catch (err) {
      lastErr = err;

      // Only the 503 UNAVAILABLE case triggers reconstruct-and-retry.
      if (!isUnavailableError(err) || attempt === MAX_RETRIES) {
        throw err;
      }

      const waitMs = 1000 * (attempt + 1);
      console.warn(
        `[meetscribe] Gemini 503 UNAVAILABLE — reconstructing context from local ` +
        `document_chunks + chat_messages and re-transmitting (attempt ${attempt + 1}/${MAX_RETRIES}, wait ${waitMs}ms)`
      );
      await sleep(waitMs);
      // The prompt is already fully reconstructed from local data, so the retry
      // re-sends the complete context rather than relying on API memory.
    }
  }

  throw lastErr;
}

module.exports = { answerQuestion, isConfigured, isUnavailableError };
