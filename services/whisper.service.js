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

const NOISE_RE = /^[\s\[\(]*(blank_audio|silence|inaudible|music|applause|no speech|click|clic|clicks)[\s\]\).]*$/i;

class WhisperService {
  static isAvailable() {
    return fs.existsSync(BIN_PATH) && fs.existsSync(MODEL_PATH);
  }

  static describe() {
    return { bin: BIN_PATH, model: MODEL_PATH, available: WhisperService.isAvailable() };
  }

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
        '-np',            // no progress 
        '-sns',           // suppress non-speech tokens
        '-otxt',          // write a .txt file
        '-of', outBase,   // output file base
      ];

      execFile(BIN_PATH, args, { cwd: BIN_DIR, timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err) => {

        let text = '';
        try {
          if (fs.existsSync(txtPath)) {
            text = fs.readFileSync(txtPath, 'utf8');
            fs.unlinkSync(txtPath);
          }
        } catch {
        }

        if (err && !text) {
          return reject(err);
        }

        // Collapse whitespace
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned || NOISE_RE.test(cleaned)) return resolve('');
        if (/^[([][^\])]*[\])]$/.test(cleaned)) return resolve('');
        resolve(cleaned);
      });
    });
  }
}

module.exports = WhisperService;
