const { GoogleGenAI } = require('@google/genai');

// Shared @google/genai client for the MeetScribe RAG feature (embeddings +
// generation). Accepts GEMINI_API_KEY or GOOGLE_API_KEY.
function readApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') return null;
  return key;
}

let client = null;

function getAI() {
  const apiKey = readApiKey();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured. Add your key to .env to use MeetScribe AI.');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

module.exports = {
  getAI,
  isConfigured: () => Boolean(readApiKey()),
  // Embedding dimensionality — MUST match the VECTOR(1536) migration column.
  EMBEDDING_DIM: 1536,
  EMBEDDING_MODEL: 'gemini-embedding-001',
  GENERATION_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
};
