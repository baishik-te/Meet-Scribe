const DeepgramService = require('./deepgram.service');
const WhisperService = require('./whisper.service');

// Default cooldown when Deepgram reports a quota error without a retry hint.
const DEFAULT_COOLDOWN_MS = 60000;

const NON_QUOTA_COOLDOWN_MS = 15000;

// While > now, Deepgram is skipped and whisper handles transcription.
let deepgramCooldownUntil = 0;
// Track the currently-active engine so we only log on transitions (not spam).
let activeEngine = null;

function log(message) {
  console.log(`[STT] ${message}`);
}

function announce(engine, reason) {
  if (activeEngine === engine) return;
  activeEngine = engine;
  const label =
    engine === 'deepgram' ? 'Deepgram API' : engine === 'whisper' ? 'whisper.cpp (local)' : 'none';
  log(`live transcription engine → ${label}${reason ? ` ${reason}` : ''}`);
}

const SttService = {
  /** Which engines are usable right now. */
  enginesAvailable() {
    return { deepgram: DeepgramService.isConfigured(), whisper: WhisperService.isAvailable() };
  },

  /** True if at least one engine can run. */
  isAvailable() {
    return DeepgramService.isConfigured() || WhisperService.isAvailable();
  },

 
  async transcribeWav(wavPath) {
    const now = Date.now();
    const canUseDeepgram = DeepgramService.isConfigured() && now >= deepgramCooldownUntil;

    if (canUseDeepgram) {
      try {
        const text = await DeepgramService.transcribeWav(wavPath);
        announce('deepgram');
        return { text, engine: 'deepgram' };
      } catch (err) {
        if (DeepgramService.isQuotaError(err)) {
          deepgramCooldownUntil = Date.now() + DEFAULT_COOLDOWN_MS;
          log(`Deepgram quota/rate limit hit — switching to whisper.cpp for ~${Math.round(DEFAULT_COOLDOWN_MS / 1000)}s`);
        } else {
          deepgramCooldownUntil = Date.now() + NON_QUOTA_COOLDOWN_MS;
          log(`Deepgram error: ${err.message} — using whisper.cpp for ~${NON_QUOTA_COOLDOWN_MS / 1000}s`);
        }
        // fall through to whisper
      }
    }

    if (WhisperService.isAvailable()) {
      const text = await WhisperService.transcribeWav(wavPath);
      const cooling = DeepgramService.isConfigured() && Date.now() < deepgramCooldownUntil;
      announce('whisper', DeepgramService.isConfigured() ? (cooling ? '(Deepgram cooling down)' : '') : '(Deepgram not configured)');
      return { text, engine: 'whisper' };
    }

    announce('none', '(configure DEEPGRAM_API_KEY or install whisper.cpp)');
    return { text: '', engine: 'none' };
  },
};

module.exports = SttService;
