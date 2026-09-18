const { GoogleGenerativeAI } = require('@google/generative-ai');


const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Accept either GEMINI_API_KEY or GOOGLE_API_KEY (the name used in the agent
// architecture diagram). GEMINI_API_KEY wins if both are set.
function readApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') return null;
  return key;
}

let client = null;

function getClient() {
  const apiKey = readApiKey();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add your key to .env to enable Gemini transcription and summaries.'
    );
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

class GeminiService {
  static isConfigured() {
    return Boolean(readApiKey());
  }

  /**
   * Detect quota / rate-limit errors so the caller can fall back to whisper.
   * Matches HTTP 429, RESOURCE_EXHAUSTED, and the free-tier quota message.
   */
  static isQuotaError(err) {
    if (!err) return false;
    const msg = err.message || String(err);
    const status = err.status || err.statusCode || err.code;
    return (
      status === 429 ||
      status === 'RESOURCE_EXHAUSTED' ||
      /\b429\b|quota|rate.?limit|resource_exhausted|too many requests|free_tier_requests/i.test(msg)
    );
  }

  /**
   * Parse the "Please retry in 46.28s" hint from a quota error, in ms.
   * Returns null when no hint is present.
   */
  static parseRetryMs(err) {
    const msg = (err && err.message) || '';
    const m = msg.match(/retry in ([\d.]+)\s*s/i);
    if (m) return Math.ceil(parseFloat(m[1]) * 1000);
    return null;
  }

  /**
   * Summarize a full call transcript into a concise, structured summary.
   *
   * @param {string} transcript  The transcript text (speaker-prefixed lines).
   * @returns {Promise<string>}   Markdown-ish summary text.
   */
  static async summarizeTranscript(transcript) {
    const model = getClient().getGenerativeModel({ model: MODEL });

    const prompt =
      'Summarize the following video call transcript. Base the summary strictly on what ' +
      'is actually said in the transcript.\n\n' +
      'Rules:\n' +
      '- Be concise and factual. Use only information present in the transcript.\n' +
      '- Do NOT speculate about audio quality, captioning artifacts, background noise, ' +
      'why the transcript looks a certain way, or the speakers\' intent.\n' +
      '- Do NOT add meta-commentary, disclaimers, or narrative framing ' +
      '(e.g. "This transcript consists of fragmented utterances").\n' +
      '- Do NOT invent topics, decisions, or action items that are not stated.\n' +
      '- Omit filler, greetings, and small talk unless they are the only content.\n' +
      '- If the transcript contains no substantive discussion, output exactly one line: ' +
      '"No substantive discussion was recorded." and nothing else.\n\n' +
      'Output format (use these exact Markdown headings; omit a section entirely if it has no real content):\n' +
      '## Overview\n' +
      'One or two factual sentences stating what was discussed.\n\n' +
      '## Key Points\n' +
      '- Bullet points of concrete topics, questions, or statements actually made.\n\n' +
      '## Action Items & Decisions\n' +
      '- Bullet points of explicit decisions or follow-ups. Omit this section if there are none.\n\n' +
      'Transcript:\n' +
      transcript;

    const result = await model.generateContent(prompt);
    return (result.response.text() || '').trim();
  }
}

module.exports = GeminiService;
