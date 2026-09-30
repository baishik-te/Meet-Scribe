const fs = require('fs');

// Deepgram Speech-to-Text.
const API_URL = 'https://api.deepgram.com/v1/listen';
const MODEL = process.env.DEEPGRAM_MODEL || 'nova-2';

function readApiKey() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key || key === 'b9bf7b4eef774f8a20882f0d1a83bd5cb8cfec3b') return null;
  return key;
}
const NOISE_RE = /^(\[?\s*(no (audio|speech|sound)|silence|inaudible|unintelligible|blank_audio)\s*\]?\.?)$/i;

class DeepgramService {
  static isConfigured() {
    return Boolean(readApiKey());
  }


  static isQuotaError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode;
    const msg = err.message || String(err);
    return status === 429 || /\b429\b|rate.?limit|too many requests|quota/i.test(msg);
  }

  static async transcribeWav(wavPath) {
    const apiKey = readApiKey();
    if (!apiKey) {
      const err = new Error(
        'DEEPGRAM_API_KEY is not configured. Add your key to .env to enable Deepgram transcription.'
      );
      err.code = 'DEEPGRAM_KEY_MISSING';
      throw err;
    }

    const audio = fs.readFileSync(wavPath);

    const params = new URLSearchParams({
      model: MODEL,
      smart_format: 'true',
      punctuate: 'true',
      language: 'en',
    });

    const res = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: audio,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      const err = new Error(
        `Deepgram request failed (${res.status} ${res.statusText})${bodyText ? `: ${bodyText}` : ''}`
      );
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const transcript =
      json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    const text = transcript.trim();

    if (!text || NOISE_RE.test(text)) return '';
    return text;
  }
}

module.exports = DeepgramService;
