const fs = require('fs');

// Deepgram Speech-to-Text.
//
// The live-transcription pipeline segments each speaker's audio into short
// utterances and writes them as 16 kHz mono WAV files (see
// transcription-bot.service.js). Deepgram's pre-recorded endpoint is the
// natural fit for that file-per-utterance model, so we POST each WAV to
// https://api.deepgram.com/v1/listen and read back the transcript.
//
// The API key is read exclusively from process.env.DEEPGRAM_API_KEY.

const API_URL = 'https://api.deepgram.com/v1/listen';
// nova-2 is a strong, broadly-available pre-recorded model. Override via env.
const MODEL = process.env.DEEPGRAM_MODEL || 'nova-2';

function readApiKey() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key || key === 'your_deepgram_api_key_here') return null;
  return key;
}

// Lines Deepgram (or empty results) can produce for non-speech → treat as empty.
const NOISE_RE = /^(\[?\s*(no (audio|speech|sound)|silence|inaudible|unintelligible|blank_audio)\s*\]?\.?)$/i;

class DeepgramService {
  static isConfigured() {
    return Boolean(readApiKey());
  }

  /**
   * Detect quota / rate-limit errors so the caller can back off.
   * Deepgram returns HTTP 429 when rate limited.
   */
  static isQuotaError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode;
    const msg = err.message || String(err);
    return status === 429 || /\b429\b|rate.?limit|too many requests|quota/i.test(msg);
  }

  /**
   * Transcribe a WAV file to plain text via Deepgram's pre-recorded API.
   * Throws on API/network errors so callers can fall back to whisper.cpp.
   *
   * @param {string} wavPath  Path to a 16 kHz mono WAV file.
   * @returns {Promise<string>} Transcript, or '' when no intelligible speech.
   */
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
