const { getAI, isConfigured, GENERATION_MODEL } = require('./genaiClient');

/**
 * RAG generation step: answer a question using only the retrieved chunks.
 *
 * @param {string} question
 * @param {Array<{ page_number: number|null, content: string }>} contexts
 * @returns {Promise<string>}
 */
async function answerQuestion(question, contexts) {
  const contextText = contexts
    .map((c) => `[Page ${c.page_number ?? '?'}]\n${c.content}`)
    .join('\n\n');

  const prompt =
    'You are MeetScribe AI, an assistant that answers questions about an uploaded PDF.\n' +
    "Answer using ONLY the provided context. If the answer isn't in the context, say you " +
    "couldn't find it in the document. Where helpful, cite page numbers like \"(page 4)\".\n\n" +
    `Context:\n${contextText}\n\n` +
    `Question: ${question}\n\nAnswer:`;

  const res = await getAI().models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
  });

  return (res.text || '').trim();
}

module.exports = { answerQuestion, isConfigured };
