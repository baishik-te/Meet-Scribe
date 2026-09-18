const { getAI, isConfigured, EMBEDDING_DIM, EMBEDDING_MODEL } = require('./genaiClient');

/**
 * Embed text with gemini-embedding-001.
 * Uses distinct task types per Google's RAG guidance: RETRIEVAL_DOCUMENT for
 * stored chunks, RETRIEVAL_QUERY for user questions.
 */
async function embed(text, taskType) {
  const res = await getAI().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: EMBEDDING_DIM },
  });
  const values = res.embeddings && res.embeddings[0] && res.embeddings[0].values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding response (dim=${values ? values.length : 'none'})`);
  }
  return values;
}

async function generateDocumentEmbedding(text) {
  return embed(text, 'RETRIEVAL_DOCUMENT');
}

async function generateQueryEmbedding(query) {
  return embed(query, 'RETRIEVAL_QUERY');
}

module.exports = {
  generateDocumentEmbedding,
  generateQueryEmbedding,
  isConfigured,
  EMBEDDING_DIM,
};
