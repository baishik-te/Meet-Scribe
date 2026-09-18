const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');

function resolvePath(p, fallback) {
  const value = p || fallback;
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
}

const BIN_PATH = resolvePath(process.env.WHISPER_BIN, 'tools/whisper/bin/Release/whisper-cli.exe');
const MODEL_PATH = resolvePath(process.env.WHISPER_MODEL, 'tools/whisper/models/ggml-base.en.bin');
const THREADS = parseInt(process.env.WHISPER_THREADS, 10) || 4;
const BIN_DIR = path.dirname(BIN_PATH);

// Lines whisper.cpp emits for non-speech that should be treated as empty.
const NOISE_RE = /^[\s\[\(]*(blank_audio|silence|inaudible|music|applause|no speech|click|clic|clicks)[\s\]\).]*$/i;

class WhisperService {
  static isAvailable() {
    return fs.existsSync(BIN_PATH) && fs.existsSync(MODEL_PATH);
  }

  static describe() {
    return { bin: BIN_PATH, model: MODEL_PATH, available: WhisperService.isAvailable() };
  }

  /**
   * Transcribe a 16 kHz mono WAV file to plain text using whisper.cpp.
   * Returns '' when the clip contains no intelligible speech.
   *
   * @param {string} wavPath  Absolute path to a .wav file.
   * @returns {Promise<string>}
   */
  static transcribeWav(wavPath) {
    return new Promise((resolve, reject) => {
      if (!WhisperService.isAvailable()) {
        return reject(new Error('whisper.cpp binary or model not found. Check WHISPER_BIN / WHISPER_MODEL.'));
      }

      const outBase = `${wavPath}.out`;
      const txtPath = `${outBase}.txt`;
      const args = [
        '-m', MODEL_PATH,
        '-f', wavPath,
        '-t', String(THREADS),
        '-nt',            // no timestamps
        '-np',            // no progress / system prints
        '-sns',           // suppress non-speech tokens (fewer hallucinations)
        '-otxt',          // write a .txt file
        '-of', outBase,   // output file base (whisper appends .txt)
      ];

      execFile(BIN_PATH, args, { cwd: BIN_DIR, timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err) => {
        // Read + clean up the output file regardless of how the process exited.
        let text = '';
        try {
          if (fs.existsSync(txtPath)) {
            text = fs.readFileSync(txtPath, 'utf8');
            fs.unlinkSync(txtPath);
          }
        } catch {
          /* ignore read/cleanup errors */
        }

        if (err && !text) {
          return reject(err);
        }

        // Collapse whitespace; drop pure non-speech markers.
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned || NOISE_RE.test(cleaned)) return resolve('');
        // whisper emits sound descriptions like "(electronic beeping)" or
        // "[BLANK_AUDIO]" for non-speech — drop when the whole line is one such
        // bracketed/parenthesized phrase.
        if (/^[([][^\])]*[\])]$/.test(cleaned)) return resolve('');
        resolve(cleaned);
      });
    });
  }
}

module.exports = WhisperService;
