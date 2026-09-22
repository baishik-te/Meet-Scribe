const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Room, RoomEvent, AudioStream, TrackKind } = require('@livekit/rtc-node');

const { Transcription } = require('../models');
const SttService = require('./stt.service');
const SocketService = require('./socket.service');
const LiveKitService = require('./livekit.service');

const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const SAMPLE_RATE = 16000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SILENCE_RMS = 450;        
const SILENCE_HANG_MS = 700;    
const MAX_UTTERANCE_MS = 15000; 
const MIN_UTTERANCE_MS = 700;   
const LEADING_SILENCE_CAP_MS = 1500; 

function computeRms(int16) {
  if (int16.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < int16.length; i++) sum += int16[i] * int16[i];
  return Math.sqrt(sum / int16.length);
}

function mergeInt16(chunks, total) {
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// Average interleaved multi-channel PCM down to a single mono channel.
function downmixToMono(interleaved, channels) {
  if (channels <= 1) return interleaved;
  const frames = Math.floor(interleaved.length / channels);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += interleaved[i * channels + c];
    out[i] = (sum / channels) | 0;
  }
  return out;
}

function writeWav(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);

  const p = path.join(os.tmpdir(), `lk-transcribe-${uuidv4()}.wav`);
  fs.writeFileSync(p, buf);
  return p;
}

class TranscriptionBot {
  constructor(call) {
    this.call = call;
    this.room = null;
    this.stopped = false;
    this.readers = new Set();
  }

  async start() {
    const token = await LiveKitService.generateToken(
      this.call.roomName,
      `transcriber-${this.call.id}`,
      'Transcriber'
    );

    this.room = new Room();
    this.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (this.stopped) return;
      // Never transcribe another bot's audio (there won't be one, but be safe).
      if (participant.identity && participant.identity.startsWith('transcriber-')) return;
      if (track.kind === TrackKind.KIND_AUDIO) {
        this.consumeAudio(track, participant);
      }
    });

    await this.room.connect(LIVEKIT_URL, token, { autoSubscribe: true, dynacast: false });
  }

  consumeAudio(track, participant) {
    const stream = new AudioStream(track, { sampleRate: SAMPLE_RATE, numChannels: 1 });
    const reader = stream.getReader();
    this.readers.add(reader);

    const state = { buf: [], samples: 0, silenceSamples: 0, hasSpeech: false, rate: SAMPLE_RATE, channels: 1 };

    (async () => {
      try {
        while (!this.stopped) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          this.processFrame(value, state, participant);
        }
      } catch {
        /* stream ended / track unsubscribed */
      } finally {
        this.readers.delete(reader);
      }
    })();
  }

  processFrame(frame, state, participant) {
    state.rate = frame.sampleRate || state.rate;
    state.channels = frame.channels || 1;

    if (!state.logged) {
      state.logged = true;
      console.log(
        `[transcription-bot] audio from ${participant.identity}: ${state.rate}Hz, ${state.channels}ch`
      );
    }

    const mono = state.channels > 1 ? downmixToMono(frame.data, state.channels) : frame.data;
    const count = mono.length;
    const rms = computeRms(mono);

    state.buf.push(Int16Array.from(mono));
    state.samples += count;

    if (rms > SILENCE_RMS) {
      state.hasSpeech = true;
      state.silenceSamples = 0;
    } else {
      state.silenceSamples += count;
    }

    const durMs = (state.samples / state.rate) * 1000;
    const silMs = (state.silenceSamples / state.rate) * 1000;

    if (state.hasSpeech && (silMs >= SILENCE_HANG_MS || durMs >= MAX_UTTERANCE_MS)) {
      this.flush(state, participant);
    } else if (!state.hasSpeech && durMs > LEADING_SILENCE_CAP_MS) {
      // Bound memory while nobody is speaking.
      state.buf = [];
      state.samples = 0;
      state.silenceSamples = 0;
    }
  }

  // Snapshot + reset happen synchronously; whisper runs async afterwards.
  flush(state, participant) {
    const merged = mergeInt16(state.buf, state.samples);
    const rate = state.rate;
    const durMs = (state.samples / rate) * 1000;
    state.buf = [];
    state.samples = 0;
    state.silenceSamples = 0;
    state.hasSpeech = false;

    if (durMs < MIN_UTTERANCE_MS) return;

    const wavPath = writeWav(merged, rate);
    SttService.transcribeWav(wavPath)
      .then(({ text }) => {
        if (text && !this.stopped) return this.publish(text, participant);
      })
      .catch((err) => console.error('[transcription-bot] STT error:', err.message))
      .finally(() => fs.promises.unlink(wavPath).catch(() => {}));
  }

  async publish(text, participant) {
    const speakerId = UUID_RE.test(participant.identity) ? participant.identity : null;
    let transcript = null;
    if (speakerId) {
      try {
        transcript = await Transcription.create({ callId: this.call.id, speakerId, text });
      } catch (err) {
        console.error('[transcription-bot] failed to save transcript:', err.message);
      }
    }

    SocketService.emitToRoom(this.call.roomName, 'transcription:new', {
      transcript: transcript || { text, callId: this.call.id },
      speakerName: participant.name || 'Speaker',
    });
  }

  async stop() {
    this.stopped = true;
    for (const reader of this.readers) {
      reader.cancel().catch(() => {});
    }
    this.readers.clear();
    try {
      await this.room?.disconnect();
    } catch {
      /* ignore */
    }
    this.room = null;
  }
}

// Manager: one bot per callId
const bots = new Map();

module.exports = {
  isAvailable: () => SttService.isAvailable(),
  async startForCall(call) {
    if (!call || bots.has(call.id)) return;
    const engines = SttService.enginesAvailable();
    if (!engines.deepgram && !engines.whisper) {
      console.warn('[transcription-bot] no STT engine available; skipping. Set DEEPGRAM_API_KEY or install whisper.cpp.');
      return;
    }
    console.log(
      `[transcription-bot] STT engines — Deepgram: ${engines.deepgram ? 'yes (preferred)' : 'no'}, whisper.cpp: ${engines.whisper ? 'yes (fallback)' : 'no'}`
    );
    const bot = new TranscriptionBot(call);
    bots.set(call.id, bot);
    try {
      await bot.start();
      console.log(`[transcription-bot] started for room ${call.roomName}`);
    } catch (err) {
      console.error('[transcription-bot] failed to start:', err.message);
      bots.delete(call.id);
    }
  },

  async stopForCall(callId) {
    const bot = bots.get(callId);
    if (!bot) return;
    bots.delete(callId);
    await bot.stop();
    console.log(`[transcription-bot] stopped for call ${callId}`);
  },
};
